import express from 'express';
import session from 'express-session';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { assessmentRecommendationsSchema } from './ai.js';
import { createGuidanceRouter } from './guidance-route.js';
import { COLLECTIONS, isObjectIdString } from './db.js';

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(10).max(128);
const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);
const interestsSchema = z.array(z.string().trim().min(1).max(80)).max(8);
const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  interests: interestsSchema.default([]),
  bio: z.string().trim().max(500).default(''),
  location: z.string().trim().max(120).default(''),
  weekly_learning_hours: z.number().int().min(1).max(40).nullable().default(null),
});
const courseSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2).max(80),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  duration_weeks: z.number().int().min(1).max(52),
});
const opportunitySchema = z.object({
  company: z.string().trim().min(2).max(120),
  title: z.string().trim().min(3).max(160),
  category: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(2000),
  application_url: z.string().url().max(1000).refine((value) => new URL(value).protocol === 'https:', 'Use a secure HTTPS application URL.'),
});
const assessmentSchema = z.object({
  interests: interestsSchema.min(1),
  skill_level: z.enum(['beginner', 'some-experience', 'experienced']),
  work_style: z.enum(['collaborative', 'independent', 'hands-on', 'analytical', 'flexible', 'unsure']),
  technical_skills: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
  career_goals: z.array(z.string().trim().min(1).max(100)).min(1).max(5),
  weekly_availability: z.number().int().min(1).max(40).nullable().default(null),
  mode: z.enum(['ai', 'demo']),
  recommendations: assessmentRecommendationsSchema,
});
const milestoneSchema = z.object({ completed: z.boolean() });
const applicationSchema = z.object({
  status: z.enum(['interested', 'preparing', 'applied', 'interviewing', 'rejected', 'accepted', 'withdrawn']),
  notes: z.string().trim().max(1000).default(''),
});
const interviewSchema = z.object({
  question: z.string().trim().min(3).max(1000),
  answer_notes: z.string().trim().max(5000).default(''),
});
const feedbackSchema = z.object({
  category: z.enum(['general', 'bug', 'course', 'career', 'opportunity']),
  message: z.string().trim().min(10).max(3000),
  email: emailSchema.optional(),
});

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function readBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Please check the submitted information.',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    req.validatedBody = parsed.data;
    return next();
  };
}

function readId(parameter) {
  return (req, res, next) => {
    const parsed = idSchema.safeParse(req.params[parameter]);
    if (!parsed.success) return res.status(400).json({ error: 'The requested identifier is invalid.' });
    req.validatedIds ||= {};
    req.validatedIds[parameter] = parsed.data;
    return next();
  };
}

function requireUser(req, res, next) {
  if (!isObjectIdString(req.session.userId)) return res.status(401).json({ error: 'Please sign in to continue.' });
  return next();
}

function createLimiter(windowMs, limit, message) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: message }),
  });
}

function establishSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.userId = userId;
      return resolve();
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => error ? reject(error) : resolve());
  });
}

function sessionCookieOptions(secure, sameSite) {
  return { httpOnly: true, sameSite, secure, path: '/' };
}

const oid = (value) => new ObjectId(String(value));
const byPosition = (a, b) => a.position - b.position;

const publicUser = (doc) => ({
  id: String(doc._id),
  name: doc.name,
  email: doc.email,
  role: doc.role,
  interests: doc.interests || [],
});
const accountUser = (doc) => ({
  ...publicUser(doc),
  bio: doc.profile?.bio ?? null,
  location: doc.profile?.location ?? null,
  weekly_learning_hours: doc.profile?.weekly_learning_hours ?? null,
});
const courseSummary = (doc) => ({
  id: String(doc._id),
  title: doc.title,
  description: doc.description,
  category: doc.category,
  level: doc.level,
  duration_weeks: doc.duration_weeks,
  is_demo: Boolean(doc.is_demo),
});
const opportunityRecord = (doc) => ({
  id: String(doc._id),
  company: doc.company,
  title: doc.title,
  category: doc.category,
  location: doc.location,
  description: doc.description,
  application_url: doc.application_url,
  is_demo: Boolean(doc.is_demo),
  created_at: doc.created_at,
});
const applicationRecord = (doc) => ({
  id: String(doc._id),
  opportunity_id: String(doc.opportunity_id),
  status: doc.status,
  notes: doc.notes,
  applied_at: doc.applied_at ?? null,
  updated_at: doc.updated_at,
});
const milestoneRecord = (milestone) => ({
  id: String(milestone._id),
  title: milestone.title,
  description: milestone.description,
  position: milestone.position,
  completed: Boolean(milestone.completed_at),
});
const interviewRecord = (doc) => ({
  id: String(doc._id),
  question: doc.question,
  answer_notes: doc.answer_notes,
  created_at: doc.created_at,
  updated_at: doc.updated_at,
});
const assessmentRecord = (doc) => ({
  id: String(doc._id),
  interests: doc.interests,
  skill_level: doc.skill_level,
  work_style: doc.work_style,
  technical_skills: doc.technical_skills,
  career_goals: doc.career_goals,
  weekly_availability: doc.weekly_availability,
  summary: doc.summary,
  plan_details: doc.plan_details,
  source: doc.source,
  created_at: doc.created_at,
});

const GUIDANCE_DISCLAIMER = 'Career suggestions are guidance, not a guarantee of employment or a scientifically validated assessment.';

export function createApp({
  db,
  sessionStore,
  sessionSecret,
  cookieSecure = false,
  cookieSameSite = 'lax',
  allowedOrigins = [],
  aiConfig = {},
  guidanceFetch,
  rateLimits = {},
}) {
  if (!db || typeof db.collection !== 'function') throw new Error('A MongoDB database handle is required.');
  if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  if (!['lax', 'strict', 'none'].includes(cookieSameSite)) throw new Error('SESSION_COOKIE_SAME_SITE must be lax, strict, or none.');
  if (cookieSameSite === 'none' && !cookieSecure) throw new Error('SameSite=None cookies require secure cookies.');

  const col = (name) => db.collection(name);
  const users = col(COLLECTIONS.users);
  const courses = col(COLLECTIONS.courses);
  const opportunities = col(COLLECTIONS.opportunities);
  const enrollments = col(COLLECTIONS.enrollments);
  const applications = col(COLLECTIONS.applications);
  const assessments = col(COLLECTIONS.assessments);
  const roadmaps = col(COLLECTIONS.roadmaps);
  const interviews = col(COLLECTIONS.interviews);
  const feedbackCollection = col(COLLECTIONS.feedback);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
  app.use(helmet());

  const origins = new Set(allowedOrigins.map((origin) => origin.replace(/\/$/, '')));
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && origins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    } else if (origin && req.method !== 'OPTIONS' && origins.size > 0) {
      return res.status(403).json({ error: 'This origin is not allowed to use the API.' });
    }
    if (req.method === 'OPTIONS') {
      if (!origin || !origins.has(origin)) return res.status(403).end();
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).end();
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && origins.size > 0 && !origin) {
      return res.status(403).json({ error: 'An allowed request origin is required.' });
    }
    return next();
  });

  const secure = Boolean(cookieSecure);
  const sameSite = cookieSameSite;
  app.use('/api/guidance', createGuidanceRouter({
    config: aiConfig,
    fetchImpl: guidanceFetch,
    limit: rateLimits.guidance ?? 10,
    windowMs: rateLimits.guidanceWindowMs ?? 60_000,
  }));
  app.use(express.json({ limit: '20kb' }));
  app.use(session({
    store: sessionStore,
    name: 'skillbridge.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      ...sessionCookieOptions(secure, sameSite),
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }));

  const authLimiter = createLimiter(
    rateLimits.authWindowMs ?? 15 * 60_000,
    rateLimits.auth ?? 10,
    'Too many account requests. Please wait and try again.',
  );
  const feedbackLimiter = createLimiter(
    rateLimits.feedbackWindowMs ?? 60 * 60_000,
    rateLimits.feedback ?? 5,
    'Too many feedback submissions. Please wait and try again.',
  );

  const currentUserId = (req) => oid(req.session.userId);

  const auth = express.Router();
  auth.post('/register', authLimiter, readBody(z.object({
    name: z.string().trim().min(1).max(100),
    email: emailSchema,
    password: passwordSchema,
  })), asyncRoute(async (req, res) => {
    const { name, email, password } = req.validatedBody;
    const passwordHash = await bcrypt.hash(password, 12);
    const document = {
      name,
      email,
      password_hash: passwordHash,
      role: 'student',
      interests: [],
      profile: { bio: null, location: null, weekly_learning_hours: null, updated_at: new Date() },
      created_at: new Date(),
    };
    try {
      const inserted = await users.insertOne(document);
      const user = publicUser({ ...document, _id: inserted.insertedId });
      await establishSession(req, user.id);
      return res.status(201).json({ user });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ error: 'An account with that email already exists.' });
      throw error;
    }
  }));
  auth.post('/login', authLimiter, readBody(z.object({ email: emailSchema, password: passwordSchema })), asyncRoute(async (req, res) => {
    const { email, password } = req.validatedBody;
    const user = await users.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    await establishSession(req, String(user._id));
    return res.json({ user: publicUser(user) });
  }));
  auth.post('/logout', asyncRoute(async (req, res) => {
    if (req.session) await destroySession(req);
    res.clearCookie('skillbridge.sid', sessionCookieOptions(secure, sameSite));
    return res.status(204).end();
  }));
  auth.get('/me', requireUser, asyncRoute(async (req, res) => {
    const user = await users.findOne({ _id: currentUserId(req) });
    if (!user) {
      await destroySession(req);
      res.clearCookie('skillbridge.sid', sessionCookieOptions(secure, sameSite));
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    return res.json({ user: accountUser(user) });
  }));
  app.use('/api/auth', auth);

  app.get('/api/health', asyncRoute(async (_req, res) => {
    await db.command({ ping: 1 });
    return res.json({ status: 'ok' });
  }));

  app.get('/api/profile', requireUser, asyncRoute(async (req, res) => {
    const user = await users.findOne({ _id: currentUserId(req) });
    if (!user) return res.status(404).json({ error: 'Profile not found.' });
    return res.json({ user: accountUser(user) });
  }));
  app.patch('/api/profile', requireUser, readBody(profileSchema), asyncRoute(async (req, res) => {
    const { name, interests, bio, location, weekly_learning_hours: hours } = req.validatedBody;
    const user = await users.findOneAndUpdate(
      { _id: currentUserId(req) },
      {
        $set: {
          name,
          interests,
          'profile.bio': bio,
          'profile.location': location,
          'profile.weekly_learning_hours': hours,
          'profile.updated_at': new Date(),
        },
      },
      { returnDocument: 'after' },
    );
    if (!user) return res.status(404).json({ error: 'Profile not found.' });
    return res.json({ user: accountUser(user) });
  }));

  app.get('/api/courses', asyncRoute(async (_req, res) => {
    const docs = await courses
      .find({}, { projection: { 'modules.lessons.content': 0 } })
      .sort({ created_at: -1, _id: -1 })
      .toArray();
    return res.json({
      courses: docs.map((course) => ({
        ...courseSummary(course),
        lessons: [...(course.modules || [])].sort(byPosition).flatMap((module) => [...(module.lessons || [])]
          .sort(byPosition)
          .map((lesson) => ({ id: String(lesson._id), title: lesson.title, duration_minutes: lesson.duration_minutes ?? null }))),
      })),
    });
  }));
  app.get('/api/courses/:courseId', readId('courseId'), asyncRoute(async (req, res) => {
    const course = await courses.findOne({ _id: oid(req.validatedIds.courseId) });
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    return res.json({
      course: {
        ...courseSummary(course),
        modules: [...(course.modules || [])].sort(byPosition).map((module) => ({
          id: String(module._id),
          title: module.title,
          description: module.description,
          position: module.position,
          lessons: [...(module.lessons || [])].sort(byPosition).map((lesson) => ({
            id: String(lesson._id),
            title: lesson.title,
            content: lesson.content,
            position: lesson.position,
            duration_minutes: lesson.duration_minutes ?? null,
          })),
        })),
      },
    });
  }));

  app.get('/api/opportunities', asyncRoute(async (_req, res) => {
    const docs = await opportunities.find({}).sort({ created_at: -1, _id: -1 }).toArray();
    return res.json({ opportunities: docs.map(opportunityRecord) });
  }));
  app.get('/api/opportunities/:opportunityId', readId('opportunityId'), asyncRoute(async (req, res) => {
    const doc = await opportunities.findOne({ _id: oid(req.validatedIds.opportunityId) });
    if (!doc) return res.status(404).json({ error: 'Opportunity not found.' });
    return res.json({ opportunity: opportunityRecord(doc) });
  }));

  app.get('/api/me/dashboard', requireUser, asyncRoute(async (req, res) => {
    const userId = currentUserId(req);
    const [enrolled, savedCourseDocs, savedOpportunityDocs, applicationDocs] = await Promise.all([
      enrollments.find({ user_id: userId }).toArray(),
      col(COLLECTIONS.savedCourses).find({ user_id: userId }).toArray(),
      col(COLLECTIONS.savedOpportunities).find({ user_id: userId }).toArray(),
      applications.find({ user_id: userId }).toArray(),
    ]);
    return res.json({
      enrollments: enrolled.map((row) => ({
        course_id: String(row.course_id),
        progress: row.progress,
        completed_lesson_ids: (row.completed_lesson_ids || []).map(String),
      })),
      savedCourses: savedCourseDocs.map((row) => String(row.course_id)),
      savedOpportunities: savedOpportunityDocs.map((row) => String(row.opportunity_id)),
      applications: Object.fromEntries(applicationDocs.map((row) => [String(row.opportunity_id), row.status])),
    });
  }));

  app.post('/api/courses/:courseId/enrollments', requireUser, readId('courseId'), asyncRoute(async (req, res) => {
    const userId = currentUserId(req);
    const courseId = oid(req.validatedIds.courseId);
    const course = await courses.findOne({ _id: courseId }, { projection: { _id: 1 } });
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    const now = new Date();
    await enrollments.updateOne(
      { user_id: userId, course_id: courseId },
      { $setOnInsert: { progress: 0, completed_lesson_ids: [], enrolled_at: now, updated_at: now } },
      { upsert: true },
    );
    const enrollment = await enrollments.findOne({ user_id: userId, course_id: courseId });
    return res.status(200).json({
      enrollment: {
        user_id: String(enrollment.user_id),
        course_id: String(enrollment.course_id),
        progress: enrollment.progress,
        enrolled_at: enrollment.enrolled_at,
        updated_at: enrollment.updated_at,
      },
    });
  }));
  app.delete('/api/courses/:courseId/enrollments', requireUser, readId('courseId'), asyncRoute(async (req, res) => {
    const result = await enrollments.deleteOne({ user_id: currentUserId(req), course_id: oid(req.validatedIds.courseId) });
    if (!result.deletedCount) return res.status(404).json({ error: 'Enrollment not found.' });
    return res.status(204).end();
  }));
  app.post('/api/courses/:courseId/progress', requireUser, readId('courseId'), readBody(z.object({ lessonId: idSchema })), asyncRoute(async (req, res) => {
    const userId = currentUserId(req);
    const courseId = oid(req.validatedIds.courseId);
    const lessonId = oid(req.validatedBody.lessonId);
    const course = await courses.findOne({ _id: courseId });
    const lessonIds = (course?.modules || []).flatMap((module) => (module.lessons || []).map((lesson) => lesson._id));
    if (!lessonIds.some((id) => id.equals(lessonId))) {
      return res.status(404).json({ error: 'Lesson not found for this course.' });
    }
    // One atomic update: add the lesson to the completed set and recompute the percentage from the
    // stored set, so concurrent lesson completions cannot overwrite each other's progress.
    // Only ObjectIds and numbers are interpolated here, never user-supplied strings.
    const enrollment = await enrollments.findOneAndUpdate(
      { user_id: userId, course_id: courseId },
      [
        { $set: { completed_lesson_ids: { $setUnion: [{ $ifNull: ['$completed_lesson_ids', []] }, [lessonId]] } } },
        {
          $set: {
            progress: {
              $min: [100, {
                $toInt: {
                  $floor: {
                    $divide: [{ $multiply: [{ $size: { $setIntersection: ['$completed_lesson_ids', lessonIds] } }, 100] }, lessonIds.length],
                  },
                },
              }],
            },
            updated_at: '$$NOW',
          },
        },
      ],
      { returnDocument: 'after' },
    );
    if (!enrollment) return res.status(409).json({ error: 'Enroll in this course before updating lesson progress.' });
    return res.json({
      enrollment: { course_id: String(enrollment.course_id), progress: enrollment.progress, updated_at: enrollment.updated_at },
    });
  }));

  const savedResource = ({ path, collection, field, target, label, singular }) => {
    const saved = col(collection);
    const targets = col(target);
    app.get(path, requireUser, asyncRoute(async (req, res) => {
      const docs = await saved.find({ user_id: currentUserId(req) }).sort({ created_at: -1, _id: -1 }).toArray();
      return res.json({ [label]: docs.map((doc) => String(doc[field])) });
    }));
    app.put(`${path}/:id`, requireUser, readId('id'), asyncRoute(async (req, res) => {
      const targetId = oid(req.validatedIds.id);
      const exists = await targets.findOne({ _id: targetId }, { projection: { _id: 1 } });
      if (!exists) return res.status(404).json({ error: `${singular} not found.` });
      await saved.updateOne(
        { user_id: currentUserId(req), [field]: targetId },
        { $setOnInsert: { created_at: new Date() } },
        { upsert: true },
      );
      return res.status(204).end();
    }));
    app.delete(`${path}/:id`, requireUser, readId('id'), asyncRoute(async (req, res) => {
      const result = await saved.deleteOne({ user_id: currentUserId(req), [field]: oid(req.validatedIds.id) });
      if (!result.deletedCount) return res.status(404).json({ error: `Saved ${singular.toLowerCase()} not found.` });
      return res.status(204).end();
    }));
  };
  savedResource({ path: '/api/me/saved-courses', collection: COLLECTIONS.savedCourses, field: 'course_id', target: COLLECTIONS.courses, label: 'courses', singular: 'Course' });
  savedResource({ path: '/api/me/saved-opportunities', collection: COLLECTIONS.savedOpportunities, field: 'opportunity_id', target: COLLECTIONS.opportunities, label: 'opportunities', singular: 'Opportunity' });

  app.get('/api/me/applications', requireUser, asyncRoute(async (req, res) => {
    const docs = await applications.find({ user_id: currentUserId(req) }).sort({ updated_at: -1, _id: -1 }).toArray();
    const related = docs.length
      ? await opportunities.find({ _id: { $in: docs.map((doc) => doc.opportunity_id) } }, { projection: { title: 1, company: 1 } }).toArray()
      : [];
    const byId = new Map(related.map((item) => [String(item._id), item]));
    return res.json({
      applications: docs
        .filter((doc) => byId.has(String(doc.opportunity_id)))
        .map((doc) => ({
          ...applicationRecord(doc),
          created_at: doc.created_at,
          title: byId.get(String(doc.opportunity_id)).title,
          company: byId.get(String(doc.opportunity_id)).company,
        })),
    });
  }));
  app.put('/api/me/applications/:opportunityId', requireUser, readId('opportunityId'), readBody(applicationSchema), asyncRoute(async (req, res) => {
    const { status, notes } = req.validatedBody;
    const userId = currentUserId(req);
    const opportunityId = oid(req.validatedIds.opportunityId);
    const opportunity = await opportunities.findOne({ _id: opportunityId }, { projection: { _id: 1 } });
    if (!opportunity) return res.status(404).json({ error: 'Opportunity not found.' });
    const existing = await applications.findOne({ user_id: userId, opportunity_id: opportunityId }, { projection: { applied_at: 1 } });
    const now = new Date();
    await applications.updateOne(
      { user_id: userId, opportunity_id: opportunityId },
      {
        $set: { status, notes, applied_at: status === 'applied' ? (existing?.applied_at ?? now) : null, updated_at: now },
        $setOnInsert: { created_at: now },
      },
      { upsert: true },
    );
    const application = await applications.findOne({ user_id: userId, opportunity_id: opportunityId });
    return res.json({ application: applicationRecord(application) });
  }));
  app.delete('/api/me/applications/:opportunityId', requireUser, readId('opportunityId'), asyncRoute(async (req, res) => {
    const result = await applications.deleteOne({ user_id: currentUserId(req), opportunity_id: oid(req.validatedIds.opportunityId) });
    if (!result.deletedCount) return res.status(404).json({ error: 'Application tracking record not found.' });
    return res.status(204).end();
  }));

  app.post('/api/career-assessments', requireUser, readBody(assessmentSchema), asyncRoute(async (req, res) => {
    const data = req.validatedBody;
    const userId = currentUserId(req);
    const now = new Date();
    const assessmentDoc = {
      user_id: userId,
      interests: data.interests,
      skill_level: data.skill_level,
      work_style: data.work_style,
      technical_skills: data.technical_skills,
      career_goals: data.career_goals,
      weekly_availability: data.weekly_availability,
      summary: data.recommendations.summary,
      // The career directions (title, whyFit, foundationalSkills) and roadmap outline live here;
      // they are returned in order, so no separate recommendations collection is needed.
      plan_details: data.recommendations,
      source: data.mode,
      created_at: now,
    };
    const insertedAssessment = await assessments.insertOne(assessmentDoc);
    const milestones = data.recommendations.roadmap.map((milestone, index) => ({
      _id: new ObjectId(),
      title: milestone.stage,
      description: `${milestone.focus} ${milestone.activities.join(' ')}`,
      position: index + 1,
      completed_at: null,
      created_at: now,
    }));
    let roadmapId;
    try {
      const insertedRoadmap = await roadmaps.insertOne({
        user_id: userId,
        assessment_id: insertedAssessment.insertedId,
        title: 'Career exploration roadmap',
        milestones,
        created_at: now,
        updated_at: now,
      });
      roadmapId = insertedRoadmap.insertedId;
    } catch (error) {
      // Standalone MongoDB servers have no multi-document transactions, so undo the first insert.
      await assessments.deleteOne({ _id: insertedAssessment.insertedId }).catch((cleanupError) => {
        console.error('Could not remove an incomplete career assessment.', cleanupError);
      });
      throw error;
    }
    return res.status(201).json({
      assessment: assessmentRecord({ ...assessmentDoc, _id: insertedAssessment.insertedId }),
      roadmapId: String(roadmapId),
      milestones: milestones.map((milestone) => ({ id: String(milestone._id), completed: false })),
      recommendations: data.recommendations,
      disclaimer: GUIDANCE_DISCLAIMER,
    });
  }));
  app.get('/api/career-assessments/latest', requireUser, asyncRoute(async (req, res) => {
    const record = await assessments.findOne({ user_id: currentUserId(req) }, { sort: { created_at: -1, _id: -1 } });
    if (!record) return res.status(404).json({ error: 'No career assessment is available yet.' });
    const roadmap = await roadmaps.findOne({ assessment_id: record._id });
    const directions = (record.plan_details?.directions || []).map((direction, index) => ({
      title: direction.title,
      whyFit: direction.whyFit,
      foundationalSkills: direction.foundationalSkills,
      position: index + 1,
    }));
    return res.json({
      assessment: assessmentRecord(record),
      roadmapId: roadmap ? String(roadmap._id) : null,
      recommendations: {
        ...record.plan_details,
        summary: record.summary,
        directions,
      },
      milestones: [...(roadmap?.milestones || [])].sort(byPosition).map((milestone) => ({
        id: String(milestone._id),
        completed: Boolean(milestone.completed_at),
      })),
      mode: record.source,
      disclaimer: GUIDANCE_DISCLAIMER,
    });
  }));

  app.get('/api/roadmaps', requireUser, asyncRoute(async (req, res) => {
    const docs = await roadmaps.find({ user_id: currentUserId(req) }).sort({ updated_at: -1, _id: -1 }).toArray();
    return res.json({
      roadmaps: docs.map((roadmap) => ({
        id: String(roadmap._id),
        title: roadmap.title,
        assessment_id: roadmap.assessment_id ? String(roadmap.assessment_id) : null,
        created_at: roadmap.created_at,
        updated_at: roadmap.updated_at,
        milestones: [...(roadmap.milestones || [])].sort(byPosition).map(milestoneRecord),
      })),
    });
  }));
  app.patch('/api/roadmaps/:roadmapId/milestones/:milestoneId', requireUser, readId('roadmapId'), readId('milestoneId'), readBody(milestoneSchema), asyncRoute(async (req, res) => {
    const { completed } = req.validatedBody;
    const filter = { _id: oid(req.validatedIds.roadmapId), user_id: currentUserId(req) };
    const milestoneId = oid(req.validatedIds.milestoneId);
    const roadmap = await roadmaps.findOne(filter);
    const current = roadmap?.milestones?.find((milestone) => milestone._id.equals(milestoneId));
    if (!current) return res.status(404).json({ error: 'Roadmap milestone not found.' });
    const completedAt = completed ? (current.completed_at ?? new Date()) : null;
    await roadmaps.updateOne(
      { ...filter, 'milestones._id': milestoneId },
      { $set: { 'milestones.$.completed_at': completedAt } },
    );
    return res.json({ milestone: milestoneRecord({ ...current, completed_at: completedAt }) });
  }));

  app.get('/api/me/interview-practice', requireUser, asyncRoute(async (req, res) => {
    const docs = await interviews.find({ user_id: currentUserId(req) }).sort({ updated_at: -1, _id: -1 }).limit(50).toArray();
    return res.json({ sessions: docs.map(interviewRecord) });
  }));
  app.post('/api/me/interview-practice', requireUser, readBody(interviewSchema), asyncRoute(async (req, res) => {
    const { question, answer_notes: notes } = req.validatedBody;
    const now = new Date();
    const document = { user_id: currentUserId(req), question, answer_notes: notes, created_at: now, updated_at: now };
    const inserted = await interviews.insertOne(document);
    return res.status(201).json({ session: interviewRecord({ ...document, _id: inserted.insertedId }) });
  }));
  app.patch('/api/me/interview-practice/:sessionId', requireUser, readId('sessionId'), readBody(interviewSchema), asyncRoute(async (req, res) => {
    const updated = await interviews.findOneAndUpdate(
      { _id: oid(req.validatedIds.sessionId), user_id: currentUserId(req) },
      { $set: { question: req.validatedBody.question, answer_notes: req.validatedBody.answer_notes, updated_at: new Date() } },
      { returnDocument: 'after' },
    );
    if (!updated) return res.status(404).json({ error: 'Interview practice session not found.' });
    const { id, question, answer_notes, updated_at } = interviewRecord(updated);
    return res.json({ session: { id, question, answer_notes, updated_at } });
  }));

  app.post('/api/feedback', feedbackLimiter, readBody(feedbackSchema), asyncRoute(async (req, res) => {
    const { category, message, email } = req.validatedBody;
    const signedIn = isObjectIdString(req.session?.userId);
    if (!signedIn && !email) {
      return res.status(400).json({
        error: 'Add an email address if you are not signed in, so your feedback can be associated with a contact.',
        details: { email: ['An email address is required when you are signed out.'] },
      });
    }
    const document = {
      user_id: signedIn ? oid(req.session.userId) : null,
      email: email || null,
      category,
      message,
      created_at: new Date(),
    };
    const inserted = await feedbackCollection.insertOne(document);
    return res.status(201).json({ feedback: { id: String(inserted.insertedId), category, created_at: document.created_at } });
  }));

  const asyncRequireAdmin = asyncRoute(async (req, res, next) => {
    if (!isObjectIdString(req.session.userId)) return res.status(401).json({ error: 'Please sign in to continue.' });
    const user = await users.findOne({ _id: currentUserId(req) }, { projection: { role: 1 } });
    if (user?.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
    return next();
  });
  app.get('/api/admin/summary', asyncRequireAdmin, asyncRoute(async (_req, res) => {
    const [userCount, courseCount, opportunityCount, feedbackCount] = await Promise.all([
      users.countDocuments({}),
      courses.countDocuments({}),
      opportunities.countDocuments({}),
      feedbackCollection.countDocuments({}),
    ]);
    return res.json({ users: userCount, courses: courseCount, opportunities: opportunityCount, feedback: feedbackCount });
  }));
  app.post('/api/admin/courses', asyncRequireAdmin, readBody(courseSchema), asyncRoute(async (req, res) => {
    const { title, description, category, level, duration_weeks } = req.validatedBody;
    const now = new Date();
    const starterLessons = [
      ['Explore the foundations', 'Identify the main ideas and key terms for this learning path.'],
      ['Practice with an example', 'Apply one useful idea in a small, beginner-friendly exercise.'],
      ['Reflect and plan next steps', 'Summarize what you learned and choose a next step to practice.'],
    ];
    // Modules and lessons are embedded, so the whole course is created by a single atomic insert.
    const document = {
      title,
      description,
      category,
      level,
      duration_weeks,
      is_demo: false,
      modules: [{
        _id: new ObjectId(),
        title: 'Course foundations',
        description,
        position: 1,
        lessons: starterLessons.map(([lessonTitle, content], index) => ({
          _id: new ObjectId(),
          title: lessonTitle,
          content,
          position: index + 1,
          duration_minutes: 15,
        })),
      }],
      created_at: now,
    };
    const inserted = await courses.insertOne(document);
    return res.status(201).json({
      course: { id: String(inserted.insertedId), title, description, category, level, duration_weeks, created_at: now },
    });
  }));
  app.post('/api/admin/opportunities', asyncRequireAdmin, readBody(opportunitySchema), asyncRoute(async (req, res) => {
    const { company, title, category, location, description, application_url } = req.validatedBody;
    const document = { company, title, category, location, description, application_url, is_demo: false, created_at: new Date() };
    const inserted = await opportunities.insertOne(document);
    const { is_demo, ...record } = opportunityRecord({ ...document, _id: inserted.insertedId });
    return res.status(201).json({ opportunity: record });
  }));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Please send a valid JSON request.' });
    console.error('API request failed.', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  });
  return app;
}
