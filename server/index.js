import 'dotenv/config';
import MongoStore from 'connect-mongo';
import { createApp } from './app.js';
import { COLLECTIONS, connectDatabase, ensureIndexes } from './db.js';

const required = ['MONGODB_URI', 'SESSION_SECRET'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
if (process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
if (process.env.NODE_ENV === 'production' && /replace|change.?me|example/i.test(process.env.SESSION_SECRET)) {
  throw new Error('SESSION_SECRET must be replaced with a unique random value in production.');
}
const frontendOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (process.env.NODE_ENV === 'production' && !frontendOrigins.length) {
  throw new Error('FRONTEND_ORIGINS must list the deployed frontend origin(s) in production.');
}
for (const origin of frontendOrigins) {
  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error(`FRONTEND_ORIGINS contains an invalid URL: ${origin}`);
  }
  if (parsedOrigin.origin !== origin.replace(/\/$/, '') || parsedOrigin.username || parsedOrigin.password) {
    throw new Error(`FRONTEND_ORIGINS entries must be exact origins without paths or credentials: ${origin}`);
  }
  if (process.env.NODE_ENV === 'production' && parsedOrigin.protocol !== 'https:') {
    throw new Error('Production FRONTEND_ORIGINS entries must use HTTPS.');
  }
}

const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT must be an integer between 1 and 65535.');

const cookieSecure = process.env.NODE_ENV === 'production' || process.env.SESSION_COOKIE_SECURE === 'true';
const cookieSameSite = process.env.SESSION_COOKIE_SAME_SITE || 'lax';
if (cookieSameSite === 'none' && !cookieSecure) throw new Error('SESSION_COOKIE_SAME_SITE=none requires SESSION_COOKIE_SECURE=true.');

const { client, db } = await connectDatabase({
  uri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DB || undefined,
  tls: process.env.MONGODB_TLS === 'true',
});
// Idempotent: creates the unique/query indexes the API depends on (for example, unique emails).
await ensureIndexes(db);

const app = createApp({
  db,
  sessionStore: MongoStore.create({
    client,
    dbName: db.databaseName,
    collectionName: COLLECTIONS.sessions,
    ttl: 60 * 60 * 24 * 7,
  }),
  sessionSecret: process.env.SESSION_SECRET,
  cookieSecure,
  cookieSameSite,
  allowedOrigins: frontendOrigins,
  aiConfig: {
    baseUrl: process.env.AI_BASE_URL,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
  },
});

const server = app.listen(PORT, () => {
  console.log(`SkillBridge API listening on port ${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; closing SkillBridge API.`);
  server.close(async () => {
    try {
      await client.close();
      process.exitCode = 0;
    } catch (error) {
      console.error('Error closing the MongoDB connection.', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
