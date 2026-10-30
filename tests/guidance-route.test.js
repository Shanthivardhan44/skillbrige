import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createGuidanceRouter } from '../server/guidance-route.js';

async function withGuidanceApi(options, run) {
  const app = express();
  app.use('/api/guidance', createGuidanceRouter(options));
  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
  });
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}/api/guidance`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('guidance endpoint returns a successful, clearly labeled demo response', async () => {
  await withGuidanceApi({ config: {} }, async (url) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'How can I start programming?' }),
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.mode, 'demo');
    assert.match(result.answer, /HTML structure, CSS layout, and JavaScript basics/i);
  });
});

test('guidance endpoint rejects empty prompts and incomplete assessment inputs', async () => {
  await withGuidanceApi({ config: {} }, async (url) => {
    const empty = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' }),
    });
    assert.equal(empty.status, 400);

    const invalidAssessment = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'assessment', message: 'Create my plan', interests: [] }),
    });
    assert.equal(invalidAssessment.status, 400);
    assert.match((await invalidAssessment.json()).error, /check the submitted/i);
  });
});

test('guidance endpoint reports provider failures without a success-shaped fallback', async () => {
  await withGuidanceApi({
    config: { baseUrl: 'https://provider.example/v1', apiKey: 'test-key', model: 'test-model' },
    fetchImpl: async () => new Response('', { status: 503 }),
  }, async (url) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Help me choose a career.' }),
    });
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /temporarily unavailable/i);
  });
});

test('guidance endpoint rate limits excess requests', async () => {
  await withGuidanceApi({ config: {}, limit: 2, windowMs: 60_000 }, async (url) => {
    const request = () => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Help me choose a career.' }),
    });
    assert.equal((await request()).status, 200);
    assert.equal((await request()).status, 200);
    const limited = await request();
    assert.equal(limited.status, 429);
    assert.match((await limited.json()).error, /too many guidance requests/i);
  });
});
