import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { createApp } from '../server/app.js';
import { COLLECTIONS, ensureIndexes } from '../server/db.js';
import { createFakeDb } from './helpers/fake-mongo.js';

const SESSION_SECRET = 'test-secret-with-more-than-thirty-two-characters';

const courseId = new ObjectId();
const lessonOneId = new ObjectId();
const lessonTwoId = new ObjectId();
const otherCourseId = new ObjectId();
const otherLessonId = new ObjectId();
const opportunityId = new ObjectId();

async function createSeededDb() {
  const db = createFakeDb();
  await ensureIndexes(db);
  await db.collection(COLLECTIONS.courses).insertOne({
    _id: courseId,
    title: 'Starter course',
    description: 'A practical beginner learning path.',
    category: 'Data',
    level: 'Beginner',
    duration_weeks: 2,
    is_demo: false,
    modules: [{
      _id: new ObjectId(), title: 'Module one', description: 'Basics', position: 1,
      lessons: [
        { _id: lessonOneId, title: 'First lesson', content: 'Read this.', position: 1, duration_minutes: 15 },
        { _id: lessonTwoId, title: 'Second lesson', content: 'Try this.', position: 2, duration_minutes: 20 },
      ],
    }],
    created_at: new Date('2026-01-01T00:00:00Z'),
  });
  await db.collection(COLLECTIONS.courses).insertOne({
    _id: otherCourseId,
    title: 'Another course',
    description: 'A second beginner learning path.',
    category: 'Development',
    level: 'Beginner',
    duration_weeks: 3,
    is_demo: false,
    modules: [{
      _id: new ObjectId(), title: 'Module', description: 'Basics', position: 1,
      lessons: [{ _id: otherLessonId, title: 'Other lesson', content: 'Other.', position: 1, duration_minutes: 10 }],
    }],
    created_at: new Date('2026-01-02T00:00:00Z'),
  });
  await db.collection(COLLECTIONS.opportunities).insertOne({
    _id: opportunityId,
    company: 'Example Co',
    title: 'Illustrative role',
    category: 'Data Analytics',
    location: 'Remote',
    description: 'An illustrative profile that is not a verified vacancy.',
    application_url: 'https://example.com/',
    is_demo: true,
    created_at: new Date('2026-01-01T00:00:00Z'),
  });
  return db;
}

async function withApi(options, run) {
  const db = await createSeededDb();
  const app = createApp({ db, sessionSecret: SESSION_SECRET, ...options });
  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run({ baseUrl, db });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function jsonRequest(url, method, body, cookie, origin) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return response;
}

async function register(baseUrl, body = { name: 'Alex Learner', email: 'alex@example.com', password: 'a-long-password' }) {
  const response = await jsonRequest(`${baseUrl}/api/auth/register`, 'POST', body);
  return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

const storedUsers = (db) => db.collection(COLLECTIONS.users).docs;

test('registration validates input, hashes passwords, and establishes a protected session', async () => {
  await withApi({}, async ({ baseUrl, db }) => {
    const invalid = await jsonRequest(`${baseUrl}/api/auth/register`, 'POST', { name: '', email: 'bad', password: 'short' });
    assert.equal(invalid.status, 400);
    const { response, cookie } = await register(baseUrl);
    const registered = await response.json();
    assert.equal(response.status, 201);
    assert.equal(registered.user.role, 'student');
    assert.match(registered.user.id, /^[0-9a-f]{24}$/);
    const [stored] = storedUsers(db);
    assert.notEqual(stored.password_hash, 'a-long-password');
    assert.equal(await bcrypt.compare('a-long-password', stored.password_hash), true);

    const unauthenticated = await fetch(`${baseUrl}/api/me/dashboard`);
    assert.equal(unauthenticated.status, 401);
    const authenticated = await fetch(`${baseUrl}/api/me/dashboard`, { headers: { Cookie: cookie } });
    assert.equal(authenticated.status, 200);
  });
});

test('duplicate registrations are rejected by the unique email index', async () => {
  await withApi({}, async ({ baseUrl, db }) => {
    assert.equal((await register(baseUrl)).response.status, 201);
    const duplicate = await register(baseUrl, { name: 'Someone Else', email: 'ALEX@example.com', password: 'another-long-password' });
    assert.equal(duplicate.response.status, 409);
    assert.equal(storedUsers(db).length, 1);
  });
});

test('login, logout, and authorization use server-side roles', async () => {
  await withApi({}, async ({ baseUrl, db }) => {
    const { cookie } = await register(baseUrl);
    const user = storedUsers(db)[0];
    const denied = await fetch(`${baseUrl}/api/admin/summary`, { headers: { Cookie: cookie } });
    assert.equal(denied.status, 403);

    user.role = 'admin';
    const authorized = await fetch(`${baseUrl}/api/admin/summary`, { headers: { Cookie: cookie } });
    assert.equal(authorized.status, 200);
    const summary = await authorized.json();
    assert.equal(summary.users, 1);
    assert.equal(summary.courses, 2);
    assert.equal(summary.opportunities, 1);

    const loggedIn = await jsonRequest(`${baseUrl}/api/auth/login`, 'POST', { email: user.email, password: 'a-long-password' });
    assert.equal(loggedIn.status, 200);
    assert.ok(loggedIn.headers.get('set-cookie'));
    const badLogin = await jsonRequest(`${baseUrl}/api/auth/login`, 'POST', { email: user.email, password: 'wrong-password-here' });
    assert.equal(badLogin.status, 401);
    const logoutCookie = loggedIn.headers.get('set-cookie')?.split(';')[0];
    const logout = await jsonRequest(`${baseUrl}/api/auth/logout`, 'POST', undefined, logoutCookie);
    assert.equal(logout.status, 204);
    const afterLogout = await fetch(`${baseUrl}/api/me/dashboard`, { headers: { Cookie: logoutCookie } });
    assert.equal(afterLogout.status, 401);

    const injectedRole = await jsonRequest(`${baseUrl}/api/auth/register`, 'POST', {
      name: 'Not Admin', email: 'not-admin@example.com', password: 'another-long-password', role: 'admin',
    });
    assert.equal(injectedRole.status, 201);
    assert.equal(storedUsers(db).find((item) => item.email === 'not-admin@example.com').role, 'student');
  });
});

test('admins can create courses with embedded starter lessons; students cannot', async () => {
  await withApi({}, async ({ baseUrl, db }) => {
    const { cookie } = await register(baseUrl);
    const course = { title: 'New admin course', description: 'A description with enough detail.', category: 'Career', level: 'Beginner', duration_weeks: 2 };
    const denied = await jsonRequest(`${baseUrl}/api/admin/courses`, 'POST', course, cookie);
    assert.equal(denied.status, 403);

    storedUsers(db)[0].role = 'admin';
    const created = await jsonRequest(`${baseUrl}/api/admin/courses`, 'POST', course, cookie);
    assert.equal(created.status, 201);
    const { course: createdCourse } = await created.json();
    const detail = await (await fetch(`${baseUrl}/api/courses/${createdCourse.id}`)).json();
    assert.equal(detail.course.modules.length, 1);
    assert.equal(detail.course.modules[0].lessons.length, 3);
    assert.deepEqual(detail.course.modules[0].lessons.map((lesson) => lesson.position), [1, 2, 3]);

    const invalidOpportunity = await jsonRequest(`${baseUrl}/api/admin/opportunities`, 'POST', {
      company: 'Example Co', title: 'Insecure link', category: 'Data', location: 'Remote', description: 'A sufficiently long description.', application_url: 'http://example.com',
    }, cookie);
    assert.equal(invalidOpportunity.status, 400);
  });
});

test('profile updates validate and return the account-backed fields', async () => {
  await withApi({}, async ({ baseUrl }) => {
    const { cookie } = await register(baseUrl);
    const response = await jsonRequest(`${baseUrl}/api/profile`, 'PATCH', {
      name: 'Alex Learner',
      interests: ['Data', 'Web development'],
      bio: 'Learning a little each week.',
      location: 'North region',
      weekly_learning_hours: 4,
    }, cookie);
    assert.equal(response.status, 200);
    const { user } = await response.json();
    assert.equal(user.bio, 'Learning a little each week.');
    assert.equal(user.weekly_learning_hours, 4);
    assert.equal('password_hash' in user, false);
    const me = await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } })).json();
    assert.deepEqual(me.user.interests, ['Data', 'Web development']);
    assert.equal(me.user.location, 'North region');
    const invalid = await jsonRequest(`${baseUrl}/api/profile`, 'PATCH', { name: '', interests: [] }, cookie);
    assert.equal(invalid.status, 400);
  });
});

test('catalog endpoints return string ids, ordered lessons, and reject malformed ids', async () => {
  await withApi({}, async ({ baseUrl }) => {
    const list = await (await fetch(`${baseUrl}/api/courses`)).json();
    assert.equal(list.courses.length, 2);
    assert.equal(list.courses[0].id, String(otherCourseId));
    const starter = list.courses.find((course) => course.id === String(courseId));
    assert.deepEqual(starter.lessons.map((lesson) => lesson.title), ['First lesson', 'Second lesson']);
    assert.equal('content' in starter.lessons[0], false);
    assert.equal((await fetch(`${baseUrl}/api/courses/${new ObjectId()}`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/courses/123`)).status, 400);
    assert.equal((await fetch(`${baseUrl}/api/opportunities/not-an-id`)).status, 400);
    const opportunities = await (await fetch(`${baseUrl}/api/opportunities`)).json();
    assert.equal(opportunities.opportunities[0].is_demo, true);
  });
});

test('enrollment, lesson progress, and saved-course operations are user-protected and persisted', async () => {
  await withApi({}, async ({ baseUrl }) => {
    const { cookie } = await register(baseUrl);
    const early = await jsonRequest(`${baseUrl}/api/courses/${courseId}/progress`, 'POST', { lessonId: String(lessonOneId) }, cookie);
    assert.equal(early.status, 409, 'progress requires enrollment');

    const enrolled = await jsonRequest(`${baseUrl}/api/courses/${courseId}/enrollments`, 'POST', {}, cookie);
    assert.equal(enrolled.status, 200);
    const again = await jsonRequest(`${baseUrl}/api/courses/${courseId}/enrollments`, 'POST', {}, cookie);
    assert.equal(again.status, 200);
    assert.equal((await jsonRequest(`${baseUrl}/api/courses/${new ObjectId()}/enrollments`, 'POST', {}, cookie)).status, 404);

    const foreignLesson = await jsonRequest(`${baseUrl}/api/courses/${courseId}/progress`, 'POST', { lessonId: String(otherLessonId) }, cookie);
    assert.equal(foreignLesson.status, 404, 'lessons from another course are rejected');

    const half = await jsonRequest(`${baseUrl}/api/courses/${courseId}/progress`, 'POST', { lessonId: String(lessonOneId) }, cookie);
    assert.equal(half.status, 200);
    assert.equal((await half.json()).enrollment.progress, 50);
    const repeated = await jsonRequest(`${baseUrl}/api/courses/${courseId}/progress`, 'POST', { lessonId: String(lessonOneId) }, cookie);
    assert.equal((await repeated.json()).enrollment.progress, 50, 'completing a lesson twice does not double count');
    const full = await jsonRequest(`${baseUrl}/api/courses/${courseId}/progress`, 'POST', { lessonId: String(lessonTwoId) }, cookie);
    assert.equal((await full.json()).enrollment.progress, 100);

    const dashboard = await (await fetch(`${baseUrl}/api/me/dashboard`, { headers: { Cookie: cookie } })).json();
    assert.equal(dashboard.enrollments.length, 1);
    assert.equal(dashboard.enrollments[0].course_id, String(courseId));
    assert.equal(dashboard.enrollments[0].progress, 100);
    assert.deepEqual([...dashboard.enrollments[0].completed_lesson_ids].sort(), [String(lessonOneId), String(lessonTwoId)].sort());

    const saved = await jsonRequest(`${baseUrl}/api/me/saved-courses/${courseId}`, 'PUT', undefined, cookie);
    assert.equal(saved.status, 204);
    assert.equal((await jsonRequest(`${baseUrl}/api/me/saved-courses/${courseId}`, 'PUT', undefined, cookie)).status, 204, 'saving is idempotent');
    assert.equal((await jsonRequest(`${baseUrl}/api/me/saved-courses/${new ObjectId()}`, 'PUT', undefined, cookie)).status, 404);
    const items = await fetch(`${baseUrl}/api/me/saved-courses`, { headers: { Cookie: cookie } });
    assert.deepEqual((await items.json()).courses, [String(courseId)]);
    const removed = await jsonRequest(`${baseUrl}/api/me/saved-courses/${courseId}`, 'DELETE', undefined, cookie);
    assert.equal(removed.status, 204);
    assert.equal((await jsonRequest(`${baseUrl}/api/me/saved-courses/${courseId}`, 'DELETE', undefined, cookie)).status, 404);

    const unenrolled = await jsonRequest(`${baseUrl}/api/courses/${courseId}/enrollments`, 'DELETE', undefined, cookie);
    assert.equal(unenrolled.status, 204);
  });
});

test('user data is private to its owner', async () => {
  await withApi({}, async ({ baseUrl }) => {
    const alex = await register(baseUrl);
    const sam = await register(baseUrl, { name: 'Sam Learner', email: 'sam@example.com', password: 'another-long-password' });
    await jsonRequest(`${baseUrl}/api/courses/${courseId}/enrollments`, 'POST', {}, alex.cookie);
    await jsonRequest(`${baseUrl}/api/me/saved-opportunities/${opportunityId}`, 'PUT', undefined, alex.cookie);
    const samDashboard = await (await fetch(`${baseUrl}/api/me/dashboard`, { headers: { Cookie: sam.cookie } })).json();
    assert.deepEqual(samDashboard.enrollments, []);
    assert.deepEqual(samDashboard.savedOpportunities, []);
    assert.equal((await jsonRequest(`${baseUrl}/api/courses/${courseId}/enrollments`, 'DELETE', undefined, sam.cookie)).status, 404);
  });
});

test('saved opportunities and application tracking persist only after authenticated server responses', async () => {
  await withApi({}, async ({ baseUrl }) => {
    const { cookie } = await register(baseUrl);
    const saved = await jsonRequest(`${baseUrl}/api/me/saved-opportunities/${opportunityId}`, 'PUT', undefined, cookie);
    assert.equal(saved.status, 204);
    const list = await fetch(`${baseUrl}/api/me/saved-opportunities`, { headers: { Cookie: cookie } });
    assert.deepEqual((await list.json()).opportunities, [String(opportunityId)]);

    assert.equal((await jsonRequest(`${baseUrl}/api/me/applications/${new ObjectId()}`, 'PUT', { status: 'applied' }, cookie)).status, 404);
    const tracked = await jsonRequest(`${baseUrl}/api/me/applications/${opportunityId}`, 'PUT', { status: 'applied', notes: 'Submitted through the employer portal. Budget: $100' }, cookie);
    assert.equal(tracked.status, 200);
    const { application } = await tracked.json();
    assert.equal(application.status, 'applied');
    assert.equal(application.notes, 'Submitted through the employer portal. Budget: $100');
    assert.ok(application.applied_at);

    const interviewing = await (await jsonRequest(`${baseUrl}/api/me/applications/${opportunityId}`, 'PUT', { status: 'interviewing' }, cookie)).json();
    assert.equal(interviewing.application.applied_at, null);
    const reapplied = await (await jsonRequest(`${baseUrl}/api/me/applications/${opportunityId}`, 'PUT', { status: 'applied' }, cookie)).json();
    assert.ok(reapplied.application.applied_at);

    const applications = await (await fetch(`${baseUrl}/api/me/applications`, { headers: { Cookie: cookie } })).json();
    assert.equal(applications.applications.length, 1);
    assert.equal(applications.applications[0].title, 'Illustrative role');
    assert.equal(applications.applications[0].company, 'Example Co');
    const dashboard = await (await fetch(`${baseUrl}/api/me/dashboard`, { headers: { Cookie: cookie } })).json();
    assert.deepEqual(dashboard.applications, { [String(opportunityId)]: 'applied' });
    const removed = await jsonRequest(`${baseUrl}/api/me/applications/${opportunityId}`, 'DELETE', undefined, cookie);
    assert.equal(removed.status, 204);
  });
});

test('career assessments persist recommendations and roadmap milestone updates', async () => {
  await withApi({}, async ({ baseUrl }) => {
    const { cookie } = await register(baseUrl);
    const plan = {
      summary: 'Start with practical data questions and build confidence through small projects.',
      directions: [
        { title: 'Data analyst', whyFit: 'You enjoy finding useful patterns in information.', foundationalSkills: ['Spreadsheets', 'SQL', 'Communication'] },
        { title: 'Web developer', whyFit: 'You want to create useful tools for other people.', foundationalSkills: ['HTML', 'CSS', 'JavaScript'] },
      ],
      roadmap: [
        { stage: 'Build foundations', focus: 'Practice the basic concepts with a small example.', activities: ['Explore a sample dataset'] },
        { stage: 'Make a project', focus: 'Use your skills to answer a useful question.', activities: ['Write down a project goal'] },
        { stage: 'Share your work', focus: 'Explain what you made and what you learned.', activities: ['Draft a short project story'] },
      ],
      projects: ['Summarize a small public dataset'],
      portfolioImprovements: ['Explain your process clearly'],
      interviewTasks: ['Practice describing one project'],
      nextAction: 'Choose one small dataset to explore.',
    };
    const payload = {
      interests: ['Data, patterns, and problem-solving'],
      skill_level: 'beginner',
      work_style: 'analytical',
      technical_skills: ['Spreadsheets'],
      career_goals: ['Prepare for internships'],
      weekly_availability: 4,
      mode: 'demo',
      recommendations: plan,
    };
    assert.equal((await fetch(`${baseUrl}/api/career-assessments/latest`, { headers: { Cookie: cookie } })).status, 404);
    const response = await jsonRequest(`${baseUrl}/api/career-assessments`, 'POST', payload, cookie);
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.milestones.length, 3);
    assert.match(created.assessment.id, /^[0-9a-f]{24}$/);
    assert.equal('user_id' in created.assessment, false);

    const update = await jsonRequest(`${baseUrl}/api/roadmaps/${created.roadmapId}/milestones/${created.milestones[0].id}`, 'PATCH', { completed: true }, cookie);
    assert.equal(update.status, 200);
    assert.equal((await update.json()).milestone.completed, true);
    const missing = await jsonRequest(`${baseUrl}/api/roadmaps/${created.roadmapId}/milestones/${new ObjectId()}`, 'PATCH', { completed: true }, cookie);
    assert.equal(missing.status, 404);

    const latest = await fetch(`${baseUrl}/api/career-assessments/latest`, { headers: { Cookie: cookie } });
    const saved = await latest.json();
    assert.equal(saved.recommendations.directions.length, 2);
    assert.equal(saved.recommendations.directions[1].position, 2);
    assert.equal(saved.recommendations.directions[0].whyFit, plan.directions[0].whyFit);
    assert.equal(saved.roadmapId, created.roadmapId);
    assert.equal(saved.milestones[0].completed, true);
    assert.equal(saved.milestones[1].completed, false);
    assert.equal(saved.mode, 'demo');

    const roadmaps = await (await fetch(`${baseUrl}/api/roadmaps`, { headers: { Cookie: cookie } })).json();
    assert.equal(roadmaps.roadmaps.length, 1);
    assert.equal(roadmaps.roadmaps[0].milestones[0].completed, true);
    assert.equal(roadmaps.roadmaps[0].assessment_id, created.assessment.id);

    const uncompleted = await jsonRequest(`${baseUrl}/api/roadmaps/${created.roadmapId}/milestones/${created.milestones[0].id}`, 'PATCH', { completed: false }, cookie);
    assert.equal((await uncompleted.json()).milestone.completed, false);

    const stranger = await register(baseUrl, { name: 'Sam Learner', email: 'sam@example.com', password: 'another-long-password' });
    const forbidden = await jsonRequest(`${baseUrl}/api/roadmaps/${created.roadmapId}/milestones/${created.milestones[1].id}`, 'PATCH', { completed: true }, stranger.cookie);
    assert.equal(forbidden.status, 404, "another user's roadmap cannot be changed");
  });
});

test('interview practice notes can be created, updated, and listed per user', async () => {
  await withApi({}, async ({ baseUrl }) => {
    const { cookie } = await register(baseUrl);
    const created = await jsonRequest(`${baseUrl}/api/me/interview-practice`, 'POST', { question: 'Tell me about a project.', answer_notes: 'Mention the dataset.' }, cookie);
    assert.equal(created.status, 201);
    const { session } = await created.json();
    const patched = await jsonRequest(`${baseUrl}/api/me/interview-practice/${session.id}`, 'PATCH', { question: 'Tell me about a project.', answer_notes: 'Mention the dataset and the result.' }, cookie);
    assert.equal(patched.status, 200);
    assert.equal((await patched.json()).session.answer_notes, 'Mention the dataset and the result.');
    const list = await (await fetch(`${baseUrl}/api/me/interview-practice`, { headers: { Cookie: cookie } })).json();
    assert.equal(list.sessions.length, 1);
    const other = await register(baseUrl, { name: 'Sam Learner', email: 'sam@example.com', password: 'another-long-password' });
    const stolen = await jsonRequest(`${baseUrl}/api/me/interview-practice/${session.id}`, 'PATCH', { question: 'Changed question?', answer_notes: '' }, other.cookie);
    assert.equal(stolen.status, 404);
  });
});

test('feedback requires a contact address when anonymous and confirms persisted submissions', async () => {
  await withApi({}, async ({ baseUrl, db }) => {
    const anonymous = await jsonRequest(`${baseUrl}/api/feedback`, 'POST', { category: 'general', message: 'A helpful feature suggestion for the platform.' });
    assert.equal(anonymous.status, 400);
    const submitted = await jsonRequest(`${baseUrl}/api/feedback`, 'POST', {
      category: 'general',
      email: 'alex@example.com',
      message: 'A helpful feature suggestion for the platform.',
    });
    assert.equal(submitted.status, 201);
    assert.equal((await submitted.json()).feedback.category, 'general');
    assert.equal(db.collection(COLLECTIONS.feedback).docs.length, 1);

    const { cookie } = await register(baseUrl);
    const signedIn = await jsonRequest(`${baseUrl}/api/feedback`, 'POST', { category: 'bug', message: 'Signed-in feedback without an email.' }, cookie);
    assert.equal(signedIn.status, 201);
    assert.ok(db.collection(COLLECTIONS.feedback).docs[1].user_id);
  });
});

test('health check pings the database', async () => {
  await withApi({}, async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('createApp requires a MongoDB database handle', () => {
  assert.throws(() => createApp({ sessionSecret: SESSION_SECRET }), /MongoDB database handle/);
});

test('cross-origin cookie APIs enforce allow-listed origins and return precise database-independent errors', async () => {
  await withApi({ allowedOrigins: ['https://skillbridge.example'] }, async ({ baseUrl }) => {
    const blocked = await jsonRequest(`${baseUrl}/api/auth/register`, 'POST', { name: 'Alex', email: 'alex@example.com', password: 'a-long-password' }, undefined, 'https://attacker.example');
    assert.equal(blocked.status, 403);
    const preflight = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://skillbridge.example', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  });
});
