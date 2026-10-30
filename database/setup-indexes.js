import 'dotenv/config';
import { connectDatabase, ensureIndexes } from '../server/db.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');

const { client, db } = await connectDatabase({
  uri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DB || undefined,
  tls: process.env.MONGODB_TLS === 'true',
});
try {
  await ensureIndexes(db);
  console.log(`Indexes are ready in database "${db.databaseName}".`);
} finally {
  await client.close();
}
