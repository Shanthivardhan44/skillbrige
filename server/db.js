import { MongoClient, ObjectId } from 'mongodb';

export const COLLECTIONS = {
  users: 'users',
  courses: 'courses',
  opportunities: 'opportunities',
  enrollments: 'enrollments',
  savedCourses: 'saved_courses',
  savedOpportunities: 'saved_opportunities',
  applications: 'applications',
  assessments: 'career_assessments',
  roadmaps: 'learning_roadmaps',
  interviews: 'interview_practice_sessions',
  feedback: 'user_feedback',
  sessions: 'sessions',
};

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const isObjectIdString = (value) => typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
export const toObjectId = (value) => (value instanceof ObjectId ? value : new ObjectId(String(value)));

export async function connectDatabase({ uri, dbName, tls = false }) {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10_000,
    ...(tls ? { tls: true } : {}),
  });
  await client.connect();
  // When MONGODB_DB is blank the database named in the connection string is used.
  const db = dbName ? client.db(dbName) : client.db();
  return { client, db };
}

/**
 * Creates the indexes the application relies on. Safe to run repeatedly.
 * The unique indexes replace the PostgreSQL UNIQUE / PRIMARY KEY constraints
 * and are what make duplicate registrations and duplicate saves safe under concurrency.
 */
export async function ensureIndexes(db) {
  const c = (name) => db.collection(name);
  await Promise.all([
    c(COLLECTIONS.users).createIndex({ email: 1 }, { unique: true, name: 'users_email_unique' }),
    c(COLLECTIONS.courses).createIndex({ created_at: -1 }, { name: 'courses_created_idx' }),
    c(COLLECTIONS.courses).createIndex({ title: 1 }, { name: 'courses_title_idx' }),
    c(COLLECTIONS.opportunities).createIndex({ created_at: -1 }, { name: 'opportunities_created_idx' }),
    c(COLLECTIONS.enrollments).createIndex({ user_id: 1, course_id: 1 }, { unique: true, name: 'enrollments_user_course_unique' }),
    c(COLLECTIONS.savedCourses).createIndex({ user_id: 1, course_id: 1 }, { unique: true, name: 'saved_courses_user_course_unique' }),
    c(COLLECTIONS.savedOpportunities).createIndex({ user_id: 1, opportunity_id: 1 }, { unique: true, name: 'saved_opportunities_user_opportunity_unique' }),
    c(COLLECTIONS.applications).createIndex({ user_id: 1, opportunity_id: 1 }, { unique: true, name: 'applications_user_opportunity_unique' }),
    c(COLLECTIONS.applications).createIndex({ user_id: 1, updated_at: -1 }, { name: 'applications_user_updated_idx' }),
    c(COLLECTIONS.assessments).createIndex({ user_id: 1, created_at: -1 }, { name: 'career_assessments_user_created_idx' }),
    c(COLLECTIONS.roadmaps).createIndex({ user_id: 1, assessment_id: 1 }, { unique: true, name: 'learning_roadmaps_user_assessment_unique' }),
    c(COLLECTIONS.roadmaps).createIndex({ user_id: 1, updated_at: -1 }, { name: 'learning_roadmaps_user_updated_idx' }),
    c(COLLECTIONS.interviews).createIndex({ user_id: 1, updated_at: -1 }, { name: 'interview_practice_user_updated_idx' }),
    c(COLLECTIONS.feedback).createIndex({ created_at: -1 }, { name: 'user_feedback_created_idx' }),
  ]);
}
