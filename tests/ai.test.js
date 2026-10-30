import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoGuidance, getGuidance, guidanceSchema } from '../server/ai.js';

const assessmentInput = {
  mode: 'assessment',
  message: 'Create a career exploration plan.',
  interests: ['Data and patterns'],
  experience: 'beginner',
  workStyle: 'analytical',
  technicalSkills: ['Spreadsheets'],
  careerGoals: ['Prepare for internships'],
  weeklyAvailability: 4,
};

test('guidance input validates bounded chat and required assessment preferences', () => {
  assert.equal(guidanceSchema.safeParse({ message: 'Help me explore data', interests: ['Data'] }).success, true);
  assert.equal(guidanceSchema.safeParse({ message: 'x'.repeat(1201) }).success, false);
  assert.equal(guidanceSchema.safeParse({ message: 'hi', experience: 'expert' }).success, false);
  assert.equal(guidanceSchema.safeParse({ ...assessmentInput, interests: [] }).success, false);
  assert.equal(guidanceSchema.safeParse({ ...assessmentInput, weeklyAvailability: 41 }).success, false);
});

test('unconfigured chat returns deterministic guidance explicitly labeled as demo', async () => {
  const result = await getGuidance({ message: 'How do I prepare for an internship?', interests: ['Web development'], experience: 'beginner' }, {});
  assert.equal(result.mode, 'demo');
  assert.match(result.answer, /internship plan/i);
  assert.match(result.answer, /not an AI-generated response/i);
});

test('unconfigured assessment returns every personalized planning section', async () => {
  const result = await getGuidance(assessmentInput, {});
  assert.equal(result.mode, 'demo');
  assert.equal(result.recommendations.directions.length, 3);
  assert.ok(result.recommendations.roadmap.length >= 3);
  assert.ok(result.recommendations.projects.length);
  assert.ok(result.recommendations.portfolioImprovements.length);
  assert.ok(result.recommendations.interviewTasks.length);
  assert.match(result.disclaimer, /not a guarantee of employment/i);
});

test('configured provider errors do not fall back to demo success', async () => {
  await assert.rejects(
    getGuidance({ message: 'Help me plan', interests: [], experience: 'beginner' }, {
      baseUrl: 'https://provider.example/v1',
      apiKey: 'test-key',
      model: 'test-model',
    }, async () => new Response('', { status: 503 })),
    /temporarily unavailable/i,
  );
});

test('partial provider configuration fails clearly instead of using demo mode', async () => {
  await assert.rejects(
    getGuidance({ message: 'Help me plan', interests: [], experience: 'beginner' }, { baseUrl: 'https://provider.example/v1' }),
    /configuration is incomplete/i,
  );
});

test('external providers must use HTTPS while local development providers may use HTTP', async () => {
  await assert.rejects(
    getGuidance({ message: 'Help me plan', interests: [], experience: 'beginner' }, {
      baseUrl: 'http://provider.example/v1',
      apiKey: 'test-key',
      model: 'test-model',
    }),
    /must use HTTPS/i,
  );
  const result = await getGuidance({ message: 'Help me plan', interests: [], experience: 'beginner' }, {
    baseUrl: 'http://localhost:9000/v1',
    apiKey: 'test-key',
    model: 'test-model',
  }, async () => Response.json({ choices: [{ message: { content: 'Start with one small project.' } }] }));
  assert.equal(result.mode, 'ai');
});

test('assessment provider output is validated before it is returned', async () => {
  const result = await getGuidance(assessmentInput, {
    baseUrl: 'https://provider.example/v1',
    apiKey: 'test-key',
    model: 'test-model',
  }, async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.match(body.messages[1].content, /Prepare for internships/);
    return Response.json({
      choices: [{ message: { content: JSON.stringify({
        summary: 'Explore a few practical paths at a comfortable pace.',
        directions: [
          { title: 'Data analyst', whyFit: 'You enjoy finding patterns and explaining what they mean.', foundationalSkills: ['Spreadsheets', 'SQL', 'Charts'] },
          { title: 'Web developer', whyFit: 'Building a useful interface can be a good hands-on experiment.', foundationalSkills: ['HTML', 'CSS', 'JavaScript'] },
        ],
        roadmap: [
          { stage: 'Explore', focus: 'Learn about typical role tasks.', activities: ['Compare two role descriptions.'] },
          { stage: 'Practice', focus: 'Try one foundation skill.', activities: ['Complete a beginner lesson.'] },
          { stage: 'Build', focus: 'Make a small example.', activities: ['Create a tiny project.'] },
        ],
        projects: ['Analyze a small public dataset.'],
        portfolioImprovements: ['Explain the project and your contribution.'],
        interviewTasks: ['Practice describing one challenge.'],
        nextAction: 'Spend 30 minutes exploring spreadsheet basics.',
      }) } }],
    });
  });
  assert.equal(result.mode, 'ai');
  assert.equal(result.recommendations.directions[0].title, 'Data analyst');
});

test('invalid provider assessment response is surfaced as a service failure', async () => {
  await assert.rejects(
    getGuidance(assessmentInput, {
      baseUrl: 'https://provider.example/v1',
      apiKey: 'test-key',
      model: 'test-model',
    }, async () => Response.json({ choices: [{ message: { content: '{"summary":"not enough"}' } }] })),
    /incomplete career plan/i,
  );
});

test('provider timeouts are surfaced with a retryable status', async () => {
  await assert.rejects(
    getGuidance({ message: 'Help me plan', interests: [], experience: 'beginner' }, {
      baseUrl: 'https://provider.example/v1',
      apiKey: 'test-key',
      model: 'test-model',
    }, async () => {
      const error = new Error('timeout');
      error.name = 'TimeoutError';
      throw error;
    }),
    /too long to respond/i,
  );
});

test('demo response does not imply a formal assessment', () => {
  const result = createDemoGuidance({ message: 'find a project', interests: [], experience: 'beginner' });
  assert.equal(result.mode, 'demo');
  assert.match(result.answer, /not an AI-generated response/i);
});
