import 'dotenv/config';
import { ObjectId } from 'mongodb';
import { COLLECTIONS, connectDatabase, ensureIndexes } from '../server/db.js';

// Optional illustrative catalog only. These entries are not real courses or vacancies.
// Safe to run more than once: existing demo records (matched by title/company) are skipped.

const demoCourses = [
  {
    title: 'Data Analytics Foundations', description: 'Turn raw data into useful stories with SQL, spreadsheets, and dashboards.', category: 'Data', level: 'Beginner', duration_weeks: 4,
    modules: [
      ['Ask a useful data question', 'Explore a small question with a spreadsheet.', [['Start with curiosity', 'Write a question that a small dataset might help answer.', 15], ['Inspect a spreadsheet', 'Notice columns, missing values, and simple patterns.', 20]]],
      ['Share a clear insight', 'Practice explaining a data finding.', [['Choose one finding', 'Pick one result that helps answer the question.', 15], ['Explain the result', 'Describe what you found in plain language.', 15]]],
    ],
  },
  {
    title: 'Full-Stack Web Development', description: 'Build responsive websites and practical apps from front end to back end.', category: 'Development', level: 'Beginner', duration_weeks: 8,
    modules: [
      ['Build a web page', 'Explore HTML, CSS, and JavaScript foundations.', [['Structure a page with HTML', 'Use headings and semantic elements to organize content.', 20], ['Style a page with CSS', 'Practice spacing, color, and a small responsive layout.', 20]]],
      ['Create an interactive interface', 'Practice building a responsive interface.', [['Add a JavaScript interaction', 'Connect an action to a useful visible response.', 20], ['Check the mobile layout', 'Test a narrow viewport and adjust the layout.', 15]]],
    ],
  },
  {
    title: 'AI & Machine Learning', description: 'Explore datasets, models, and the ideas behind intelligent applications.', category: 'AI & ML', level: 'Intermediate', duration_weeks: 6,
    modules: [
      ['Explore data and models', 'Learn what a dataset and a model can show.', [['Look at a small dataset', 'Identify what the data includes and leaves out.', 20], ['Understand a model output', 'Compare a simple output with a baseline.', 20]]],
      ['Build a responsible demo', 'Consider limitations and responsible use.', [['Review limitations', 'List where a model may be incorrect or biased.', 15], ['Explain a safe demo', 'Describe what the demo can and cannot do.', 15]]],
    ],
  },
  {
    title: 'Python for Problem Solving', description: 'Grow programming confidence through hands-on Python challenges.', category: 'Development', level: 'Beginner', duration_weeks: 3,
    modules: [
      ['Write a first program', 'Practice variables and simple decisions.', [['Use variables', 'Store and update a few values in a short program.', 15], ['Make a decision', 'Use a condition to choose between two actions.', 20]]],
      ['Solve a small challenge', 'Break a problem into clear steps.', [['Break down the task', 'Write the input, expected output, and a few small steps.', 15], ['Try and test a solution', 'Run a small example and check the result.', 20]]],
    ],
  },
  {
    title: 'Interview Readiness Lab', description: 'Practice communication, technical interviews, and project storytelling.', category: 'Career', level: 'Beginner', duration_weeks: 2,
    modules: [
      ['Tell a project story', 'Explain a project and what you learned.', [['Explain your contribution', 'Describe what you personally made or learned.', 15], ['Reflect on a challenge', 'Explain one decision and what you would change.', 15]]],
      ['Practice common questions', 'Build confidence with clear examples.', [['Prepare a short introduction', 'Connect your interest to one focused example.', 15], ['Practice a STAR story', 'Describe a situation, action, and what you learned.', 20]]],
    ],
  },
  {
    title: 'SQL & Data Visualization', description: 'Query datasets and communicate insights with clear visualizations.', category: 'Data', level: 'Intermediate', duration_weeks: 4,
    modules: [
      ['Ask and query', 'Practice selecting and grouping data.', [['Filter a dataset', 'Explore filtering and grouping a small table.', 20], ['Check the result', 'Compare your query result with the original question.', 15]]],
      ['Visualize a finding', 'Choose a chart and explain what it shows.', [['Choose a clear chart', 'Match a simple chart to the question you are answering.', 15], ['Tell the data story', 'Explain one chart and its limitations.', 15]]],
    ],
  },
];

const demoOpportunities = [
  { company: 'Northstar Labs', title: 'Frontend Developer Intern', category: 'Web Development', location: 'Remote', description: 'Illustrative frontend internship profile for practicing role evaluation. This is not a verified or active vacancy.', application_url: 'https://example.com/' },
  { company: 'BrightPath Insights', title: 'Data Analyst Intern', category: 'Data Analytics', location: 'Hybrid', description: 'Illustrative data internship profile for exploring common requirements. This is not a verified or active vacancy.', application_url: 'https://example.com/' },
  { company: 'FutureMind Studio', title: 'AI Research Intern', category: 'AI & ML', location: 'Remote', description: 'Illustrative AI research internship profile. This is not a verified or active vacancy.', application_url: 'https://example.com/' },
];

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');

const { client, db } = await connectDatabase({
  uri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DB || undefined,
  tls: process.env.MONGODB_TLS === 'true',
});

try {
  await ensureIndexes(db);
  const courses = db.collection(COLLECTIONS.courses);
  const opportunities = db.collection(COLLECTIONS.opportunities);
  let addedCourses = 0;
  let addedOpportunities = 0;

  // Insert in order, one at a time, so created_at/_id ordering matches the list above.
  for (const course of demoCourses) {
    if (await courses.findOne({ title: course.title }, { projection: { _id: 1 } })) continue;
    const { modules, ...fields } = course;
    await courses.insertOne({
      ...fields,
      is_demo: true,
      modules: modules.map(([title, description, lessons], moduleIndex) => ({
        _id: new ObjectId(),
        title,
        description,
        position: moduleIndex + 1,
        lessons: lessons.map(([lessonTitle, content, minutes], lessonIndex) => ({
          _id: new ObjectId(),
          title: lessonTitle,
          content,
          position: lessonIndex + 1,
          duration_minutes: minutes,
        })),
      })),
      created_at: new Date(),
    });
    addedCourses += 1;
  }

  for (const opportunity of demoOpportunities) {
    if (await opportunities.findOne({ company: opportunity.company, title: opportunity.title }, { projection: { _id: 1 } })) continue;
    await opportunities.insertOne({ ...opportunity, is_demo: true, created_at: new Date() });
    addedOpportunities += 1;
  }

  console.log(`Demo catalog ready in "${db.databaseName}": ${addedCourses} course(s) and ${addedOpportunities} opportunity record(s) added.`);
} finally {
  await client.close();
}
