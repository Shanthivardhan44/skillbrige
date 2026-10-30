import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness, Check, ChevronLeft, ChevronRight, CircleCheck, Clock3, Compass, Copy, GraduationCap, ListChecks, MapPin, MessageCircle, Plus, RefreshCw, Search, Send, Sparkles, Target, Trash2, UserRound } from 'lucide-react';
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, IconLabel, NextStep, Notice, OpportunityNote, PageTitle, ProgressBar, SearchBox, SourceNote } from './components.jsx';
import { apiFetch } from './api.js';
import { isDatabaseId, useCatalog, usePlatform } from './platform.js';

async function parseApiResponse(response, fallbackMessage) {
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }
  if (!response.ok) throw new Error(result.error || fallbackMessage);
  return result;
}

const careerData = {
  'data-analyst': { title: 'Data analyst', skills: ['Spreadsheets', 'SQL', 'Data visualization', 'Communication'], course: 'data-analytics', color: 'blue' },
  'web-developer': { title: 'Web developer', skills: ['HTML & CSS', 'JavaScript', 'React', 'Communication'], course: 'full-stack', color: 'violet' },
  'ai-practitioner': { title: 'AI practitioner', skills: ['Python', 'Statistics', 'Machine learning', 'Responsible AI'], course: 'ai-machine-learning', color: 'pink' },
};

function CourseCard({ course, source = 'demo' }) {
  const { savedCourses, enrollments, toggleCourse, enroll } = usePlatform();
  const isEnrolled = Object.hasOwn(enrollments, course.id);
  const done = enrollments[course.id] || [];
  const progress = course.lessons?.length ? Math.round((done.length / course.lessons.length) * 100) : 0;
  return <Card className="course-card">
    <div className={`course-art ${course.color || 'blue'}`}><GraduationCap size={24} /><button className={`icon-button ${savedCourses.includes(course.id) ? 'selected' : ''}`} onClick={() => toggleCourse(course.id)} aria-label={`${savedCourses.includes(course.id) ? 'Remove' : 'Save'} ${course.title}`} aria-pressed={savedCourses.includes(course.id)}><Bookmark size={17} fill={savedCourses.includes(course.id) ? 'currentColor' : 'none'} /></button></div>
    <div className="course-card-body"><div className="badge-row"><Badge>{course.category}</Badge><Badge>{course.level}</Badge>{course.is_demo && <Badge tone="demo">Illustrative</Badge>}</div><Link className="card-title-link" to={`/learning/${course.id}`}><h2>{course.title}</h2></Link><p>{course.description}</p><div className="course-details"><IconLabel icon={Clock3}>{course.duration}</IconLabel><IconLabel icon={ListChecks}>{course.lessons.length} lessons</IconLabel></div>{isEnrolled && <ProgressBar value={progress} label="Your course progress" />}<div className="card-actions"><Link className="text-link" to={`/learning/${course.id}`}>Course details <ArrowRight size={14} /></Link><Button variant="subtle" onClick={() => enroll(course.id)}>{isEnrolled ? 'Continue learning' : 'Start learning'}</Button></div></div>
    {source === 'demo' && <span className="visually-hidden">Demo course</span>}
  </Card>;
}

function OpportunityCard({ job }) {
  const { savedOpportunities, applications, toggleOpportunity, trackApplication } = usePlatform();
  return <Card className="opportunity-card"><div className={`company-mark ${job.color || 'violet'}`}>{job.company?.slice(0, 1)}</div><div className="opportunity-card-content"><div className="badge-row"><Badge>{job.category}</Badge><Badge tone="demo">Not verified</Badge></div><Link className="card-title-link" to={`/opportunities/${job.id}`}><h2>{job.title}</h2></Link><p>{job.company}</p><div className="course-details"><IconLabel icon={MapPin}>{job.location}</IconLabel><IconLabel icon={BriefcaseBusiness}>{job.level || 'Entry level'}</IconLabel></div><div className="card-actions"><button className={`text-link ${savedOpportunities.includes(job.id) ? 'saved-text' : ''}`} onClick={() => toggleOpportunity(job.id)} aria-pressed={savedOpportunities.includes(job.id)}><Bookmark size={15} fill={savedOpportunities.includes(job.id) ? 'currentColor' : 'none'} />{savedOpportunities.includes(job.id) ? 'Saved' : 'Save opportunity'}</button><select aria-label={`Track application for ${job.title}`} value={applications[job.id] || ''} onChange={(event) => trackApplication(job.id, event.target.value)}><option value="">Not started</option><option value="interested">Interested</option><option value="preparing">Preparing to apply</option><option value="applied">Applied</option><option value="interviewing">Interviewing</option><option value="accepted">Accepted</option><option value="rejected">Not selected</option><option value="withdrawn">Withdrawn</option></select></div></div></Card>;
}

export function DashboardPage() {
  const { user } = useOutletContext();
  const { account, syncingAccount, enrollments, savedOpportunities, goals, activity, quizResult, addGoal, removeGoal } = usePlatform();
  const { items: courses, source } = useCatalog('courses');
  const { items: opportunities, source: opportunitySource } = useCatalog('opportunities');
  const navigate = useNavigate();
  const [goal, setGoal] = useState('');
  const learning = courses.filter((course) => Object.hasOwn(enrollments, course.id));
  const savedJobs = opportunities.filter((job) => savedOpportunities.includes(job.id));
  const submitGoal = (event) => { event.preventDefault(); if (!goal.trim()) return; addGoal(goal.trim()); setGoal(''); };

  return <><PageTitle eyebrow="YOUR LEARNING SPACE" title={`Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ' back'}.`} description="A clear view of your learning, career goals, and next small steps." actions={<div className="badge-row"><SourceNote source={source} /><Badge tone={account ? 'success' : 'demo'}>{syncingAccount ? 'Checking account…' : account ? 'Account data synchronized' : 'Demo data on this device'}</Badge></div>} />
    <div className="dashboard-welcome"><div><span className="eyebrow">YOUR NEXT STEP</span><h2>{learning.length ? 'Pick up where you left off.' : 'Choose one path to get started.'}</h2><p>{learning.length ? 'A short focused session is enough to build momentum.' : 'Explore a learning path that matches the skills you want to grow.'}</p><NextStep to={learning.length ? `/learning/${learning[0].id}` : '/learning'}>{learning.length ? 'Continue learning' : 'Explore learning paths'}</NextStep></div><div className="welcome-orb"><Sparkles size={30} /></div></div>
    <div className="dashboard-metrics"><Card><span className="eyebrow">LEARNING PATHS</span><strong>{learning.length}</strong><p>in your learning list</p></Card><Card><span className="eyebrow">SAVED OPPORTUNITIES</span><strong>{savedOpportunities.length}</strong><p>examples saved for later</p></Card><Card className="career-metric"><span className="eyebrow">CAREER EXPLORATION</span><strong>{quizResult ? 'In progress' : 'Start here'}</strong><p>{quizResult ? 'You have a direction to explore.' : 'Suggestions are not a formal assessment.'}</p><Link className="text-link" to={quizResult ? '/career/results' : '/career/assessment'}>{quizResult ? 'View suggestions' : 'Explore interests'} <ArrowRight size={14} /></Link></Card></div>
    <div className="dashboard-columns"><section className="dashboard-block"><div className="block-heading"><div><span className="eyebrow">YOUR LEARNING</span><h2>Current paths</h2></div><Link to="/learning">Browse all <ArrowRight size={14} /></Link></div>{learning.length ? <div className="dashboard-course-list">{learning.map((course) => <CourseCard key={course.id} course={course} />)}</div> : <EmptyState icon={GraduationCap} title="Your learning space is ready" description="Start a path to track lessons and progress here." action={<Button onClick={() => navigate('/learning')}>Explore paths</Button>} />}</section>
      <div className="dashboard-side"><Card className="goals-card"><div className="block-heading"><div><span className="eyebrow">KEEP IT ACHIEVABLE</span><h2>This week&apos;s goals</h2></div></div><ul className="goal-list">{goals.map((item) => <li key={item}><span><Target size={15} />{item}</span><button aria-label={`Remove goal ${item}`} onClick={() => removeGoal(item)}><Trash2 size={15} /></button></li>)}</ul><form className="inline-form" onSubmit={submitGoal}><label className="visually-hidden" htmlFor="goal-input">Add a learning goal</label><input id="goal-input" required maxLength={100} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Add a small goal..." /><Button variant="subtle" aria-label="Add goal"><Plus size={16} /></Button></form></Card>
        <Card className="activity-card"><span className="eyebrow">YOUR RECENT ACTIVITY</span><h2>Small wins add up.</h2>{activity.length ? <ul className="activity-list">{activity.slice(0, 4).map((item, index) => <li key={`${item}-${index}`}><CircleCheck size={15} />{item}</li>)}</ul> : <p>As you save paths and complete lessons, your recent activity will show up here.</p>}</Card>
        <Card className="saved-opportunity-mini"><span className="eyebrow">OPPORTUNITIES TO EXPLORE</span><div className="badge-row"><SourceNote source={opportunitySource} /><Badge tone="demo">Not independently verified</Badge></div><h2>Explore with care.</h2>{savedJobs.length ? savedJobs.map((job) => <p key={job.id}><BriefcaseBusiness size={15} />{job.title}</p>) : <p>Role examples are not independently verified or confirmed active vacancies.</p>}<NextStep to="/opportunities">Browse examples</NextStep></Card></div></div>
  </>;
}

export function LearningCatalogPage() {
  const { items, source, loading } = useCatalog('courses');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const categories = ['All', ...new Set(items.map((course) => course.category))];
  const filtered = items.filter((course) => (category === 'All' || course.category === category) && `${course.title} ${course.description} ${course.skills.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageTitle eyebrow="LEARN WITH PURPOSE" title="Learning paths" description="Explore practical, beginner-friendly courses and build skills one lesson at a time." actions={<SourceNote source={source} />} />
    <div className="catalog-controls"><SearchBox value={search} onChange={setSearch} placeholder="Search paths or skills..." /><div className="filter-chips" aria-label="Course categories">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
    {loading && <div className="skeleton-grid" aria-label="Loading courses"><i /><i /><i /></div>}
    {!loading && filtered.length > 0 && <div className="catalog-grid">{filtered.map((course) => <CourseCard key={course.id} course={course} source={source} />)}</div>}
    {!loading && filtered.length === 0 && <EmptyState icon={Search} title="No paths match that search" description="Try a different search term or category." action={<Button variant="subtle" onClick={() => { setSearch(''); setCategory('All'); }}>Clear filters</Button>} />}
  </>;
}

export function CourseDetailPage() {
  const { courseId } = useParams();
  const { items, source } = useCatalog('courses');
  const { enrollments, enroll, savedCourses, toggleCourse } = usePlatform();
  const course = items.find((item) => item.id === courseId);
  if (!course) return <><PageTitle eyebrow="LEARNING PATH" title="Course not found." description="It may have moved or is not in this catalog." /><EmptyState icon={Search} title="We couldn't find that course" description="Browse all learning paths to find another starting point." action={<Link className="ui-button ui-button-primary" to="/learning">Browse learning paths</Link>} /></>;
  const done = enrollments[course.id] || [];
  const isEnrolled = Object.hasOwn(enrollments, course.id);
  const progress = course.lessons.length ? Math.round(done.length / course.lessons.length * 100) : 0;
  const related = items.filter((item) => item.id !== course.id && item.category === course.category).slice(0, 2);
  return <><PageTitle eyebrow={`${course.category.toUpperCase()} · ${course.level.toUpperCase()}`} title={course.title} description={course.description} actions={<SourceNote source={source} />} />
    <div className="detail-layout"><div><Card className="course-overview"><div className={`course-art ${course.color}`}><GraduationCap size={30} /></div><div className="course-details"><IconLabel icon={Clock3}>{course.duration}</IconLabel><IconLabel icon={ListChecks}>{course.lessons.length} short lessons</IconLabel><Badge>{course.level}</Badge></div><h2>What you&apos;ll practice</h2><div className="skill-tags">{course.skills.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div>{isEnrolled && <ProgressBar value={progress} label={`${done.length} of ${course.lessons.length} lessons complete`} />}<div className="detail-actions"><Button onClick={() => enroll(course.id)}>{isEnrolled ? 'Continue learning' : 'Enroll in this path'} <ArrowRight size={16} /></Button><Button variant="subtle" onClick={() => toggleCourse(course.id)}><Bookmark size={15} fill={savedCourses.includes(course.id) ? 'currentColor' : 'none'} />{savedCourses.includes(course.id) ? 'Saved' : 'Save path'}</Button></div></Card>
      {course.lessons.length ? <section className="lesson-outline"><div className="block-heading"><div><span className="eyebrow">YOUR LEARNING PLAN</span><h2>Lessons</h2></div><Badge>{done.length}/{course.lessons.length} done</Badge></div>{course.lessons.map((lesson, index) => { const completedId = course.lessonIds?.[index] ?? index; const complete = done.includes(completedId); return <Link className="lesson-row" to={`/learning/${course.id}/lessons/${index}`} key={lesson}><span className={`lesson-index ${complete ? 'lesson-done' : ''}`}>{complete ? <Check size={15} /> : index + 1}</span><span><b>{lesson}</b><small>Short lesson · learn at your own pace</small></span><ArrowUpRight size={16} /></Link>; })}</section> : <Notice>This course is listed, but lesson content has not been published yet. You can enroll now; lesson progress will be available when content is added.</Notice>}
      </div><aside className="detail-sidebar"><Card><span className="eyebrow">A GENTLE START</span><h2>Learn by doing.</h2><p>There&apos;s no need to know everything first. Take one lesson, then try the skill in a small project.</p><Button onClick={() => { enroll(course.id); }}>Add to my learning</Button></Card>{related.length > 0 && <Card><span className="eyebrow">RELATED PATHS</span>{related.map((item) => <Link className="related-row" key={item.id} to={`/learning/${item.id}`}>{item.title}<ArrowRight size={14} /></Link>)}</Card>}</aside></div>
  </>;
}

export function LessonPage() {
  const { courseId, lessonId } = useParams();
  const { items } = useCatalog('courses');
  const { enrollments, enroll, completeLesson } = usePlatform();
  const course = items.find((item) => item.id === courseId);
  const index = Number(lessonId);
  const lesson = course?.lessons[index];
  const navigate = useNavigate();
  if (!course || !lesson || !Number.isInteger(index)) return <Navigate to="/learning" replace />;
  const completedId = course.lessonIds?.[index] ?? index;
  const completed = (enrollments[course.id] || []).includes(completedId);
  const done = enrollments[course.id] || [];
  const nextLesson = index + 1 < course.lessons.length ? index + 1 : null;
  const completeAndContinue = async () => {
    const enrolled = await enroll(course.id);
    if (!enrolled) return;
    const completed = await completeLesson(course.id, completedId);
    if (!completed) return;
    if (nextLesson !== null) navigate(`/learning/${course.id}/lessons/${nextLesson}`);
    else navigate(`/learning/${course.id}`);
  };
  return <><PageTitle eyebrow="LESSON" title={lesson} description={`${course.title} · Lesson ${index + 1} of ${course.lessons.length}`} /><div className="lesson-layout"><article className="lesson-content"><Badge>LEARNING NOTE</Badge><h2>Start with curiosity, not perfection.</h2><p>Every useful skill starts with noticing a question worth answering. In this lesson, explore the key idea, try it out at your own pace, and make a note of anything you want to revisit.</p><div className="lesson-callout"><Sparkles size={18} /><p><b>Try this:</b> Write down one question you would like this skill to help you answer. Then note what you already know and what you want to learn next.</p></div><h3>Before you move on</h3><ul><li>Can you explain the main idea in your own words?</li><li>What small example could you use to practice it?</li><li>Which part would you like to explore more?</li></ul><Button onClick={completeAndContinue}>{completed ? 'Continue to next step' : nextLesson === null ? 'Finish this path' : 'Mark lesson complete'} <Check size={16} /></Button></article><aside className="lesson-outline compact"><span className="eyebrow">COURSE PLAN</span><h2>{course.title}</h2><ProgressBar value={Math.round(done.length / course.lessons.length * 100)} label={`${done.length} lessons complete`} />{course.lessons.map((item, itemIndex) => <Link className={`lesson-row ${itemIndex === index ? 'current' : ''}`} key={item} to={`/learning/${course.id}/lessons/${itemIndex}`}><span className={`lesson-index ${(enrollments[course.id] || []).includes(itemIndex) ? 'lesson-done' : ''}`}>{(enrollments[course.id] || []).includes(itemIndex) ? <Check size={14} /> : itemIndex + 1}</span><span><b>{item}</b></span></Link>)}</aside></div></>;
}

export function CareerPage() {
  const { quizResult } = usePlatform();
  const careerTitle = quizResult?.recommendations?.directions?.[0]?.title || careerData[quizResult?.career]?.title;
  const careerSummary = quizResult?.recommendations?.summary || quizResult?.summary;
  return <><PageTitle eyebrow="EXPLORE WHAT COULD FIT" title="Your career, your next step." description="Explore different roles, reflect on what interests you, and turn a big question into a practical next step." />
    <div className="career-intro"><Card><span className="career-icon"><Compass /></span><span className="eyebrow">START WITH YOUR INTERESTS</span><h2>Curiosity can be a good compass.</h2><p>A career exploration plan won&apos;t tell you who to be. It can help you choose what to explore next.</p><Link className="ui-button ui-button-primary" to="/career/assessment">Take the interest assessment <ArrowRight size={16} /></Link></Card><Card className="career-current"><span className="eyebrow">YOUR EXPLORATION</span><h2>{quizResult ? `You’re exploring ${careerTitle || 'a career path'}.` : 'No single path defines you.'}</h2><p>{quizResult ? careerSummary : 'Start with an interest assessment, compare roles, or ask for ideas. Your answers stay on this device.'}</p>{quizResult && <Link className="text-link" to="/career/results">See your suggestions <ArrowRight size={15} /></Link>}</Card></div>
    <div className="career-tools-grid">{[
      { title: 'Find a starting direction', description: 'Reflect on what you enjoy and choose a role to explore.', to: '/career/assessment', label: 'Explore interests', icon: Compass },
      { title: 'Understand skill gaps', description: 'Compare your current skills with a role you are curious about.', to: '/career/skills', label: 'Compare skills', icon: Target },
      { title: 'Plan small steps', description: 'Build a manageable roadmap toward the skills you want to practice.', to: '/career/roadmap', label: 'View roadmap', icon: ListChecks },
      { title: 'Practice interviews', description: 'Try a question and shape your answer with a simple framework.', to: '/career/interview', label: 'Start practice', icon: MessageCircle },
    ].map(({ title, description, to, label, icon: Icon }) => <Card key={to}><span className="tool-icon"><Icon size={20} /></span><h2>{title}</h2><p>{description}</p><Link className="text-link" to={to}>{label} <ArrowRight size={15} /></Link></Card>)}</div>
  </>;
}

export function AssessmentPage() {
  const { setQuizResult } = usePlatform();
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState({
    interests: [],
    experience: 'beginner',
    workStyle: 'hands-on',
    skills: [],
    otherSkills: '',
    goal: 'explore career options',
    weeklyAvailability: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const updateList = (field, value) => setAnswers((old) => ({
    ...old,
    [field]: old[field].includes(value) ? old[field].filter((item) => item !== value) : [...old[field], value],
  }));
  const submit = async (event) => {
    event?.preventDefault();
    if (loading) return;
    if (!answers.interests.length) {
      setError('Choose at least one interest so we can suggest a useful starting point.');
      return;
    }
    setLoading(true);
    setError('');
    const technicalSkills = [...answers.skills.filter((skill) => skill !== 'No technical skills yet'), ...answers.otherSkills.split(',').map((skill) => skill.trim()).filter(Boolean)].slice(0, 12);
    try {
      const response = await apiFetch('/api/guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'assessment',
          message: 'Create a personalized, beginner-friendly career exploration plan.',
          interests: answers.interests,
          experience: answers.experience,
          workStyle: answers.workStyle,
          technicalSkills,
          careerGoals: [answers.goal],
          ...(answers.weeklyAvailability ? { weeklyAvailability: Number(answers.weeklyAvailability) } : {}),
        }),
      });
      const result = await parseApiResponse(response, 'Career suggestions are unavailable right now.');
      if (!result.recommendations) throw new Error('The guidance service returned an incomplete career plan. Please try again.');
      let savedPlan = { ...result, persistence: 'device' };
      if (user) {
        try {
          const saveResponse = await apiFetch('/api/career-assessments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              interests: answers.interests,
              skill_level: answers.experience,
              work_style: answers.workStyle,
              technical_skills: technicalSkills,
              career_goals: [answers.goal],
              weekly_availability: answers.weeklyAvailability ? Number(answers.weeklyAvailability) : null,
              mode: result.mode,
              recommendations: result.recommendations,
            }),
          });
          const saved = await parseApiResponse(saveResponse, 'Your recommendations could not be saved to your account.');
          savedPlan = {
            ...savedPlan,
            persistence: 'account',
            assessmentId: String(saved.assessment.id),
            roadmapId: String(saved.roadmapId),
            roadmapMilestones: saved.milestones,
          };
        } catch (saveError) {
          savedPlan = {
            ...savedPlan,
            persistence: 'device',
            persistenceError: saveError instanceof Error ? saveError.message : 'Account sync failed.',
          };
        }
      }
      setQuizResult({ ...savedPlan, answers: { ...answers, skills: technicalSkills }, date: new Date().toISOString() });
      navigate('/career/results');
    } catch (requestError) {
      setError(requestError instanceof TypeError ? 'We could not reach the guidance service. Your answers are still here; please retry.' : requestError.message);
    } finally {
      setLoading(false);
    }
  };
  const interests = ['Building websites and useful tools', 'Data, patterns, and problem-solving', 'AI and intelligent tools', 'Helping people learn or solve problems', 'Design and creative work'];
  const skillOptions = ['Spreadsheets', 'Python', 'HTML / CSS', 'JavaScript', 'SQL', 'No technical skills yet'];
  return <><PageTitle eyebrow="NO WRONG ANSWERS" title="A little reflection can help." description="Share a few preferences to get practical directions to explore. Skip the optional details if you are not sure yet." /><form className="form-panel assessment-form" onSubmit={submit}>
    <fieldset><legend>What interests you? <span className="field-note">Choose one or more</span></legend><div className="assessment-options">{interests.map((option) => <label className={`choice-card ${answers.interests.includes(option) ? 'chosen' : ''}`} key={option}><input type="checkbox" checked={answers.interests.includes(option)} onChange={() => updateList('interests', option)} />{option}</label>)}</div></fieldset>
    <label className="form-field">How would you describe your current skill level?<select value={answers.experience} onChange={(event) => setAnswers({ ...answers, experience: event.target.value })}><option value="beginner">I am just starting</option><option value="some-experience">I have tried a few things</option><option value="experienced">I have some experience and want to grow</option></select></label>
    <label className="form-field">What work style sounds most comfortable?<select value={answers.workStyle} onChange={(event) => setAnswers({ ...answers, workStyle: event.target.value })}><option value="hands-on">Learning by building and trying things</option><option value="analytical">Investigating questions and finding patterns</option><option value="collaborative">Working and learning with others</option><option value="independent">Focusing independently</option><option value="flexible">A mix of different work</option><option value="unsure">I am not sure yet</option></select></label>
    <fieldset><legend>Which technical skills have you tried? <span className="field-note">Optional</span></legend><div className="assessment-options">{skillOptions.map((skill) => <label className={`choice-card ${answers.skills.includes(skill) ? 'chosen' : ''}`} key={skill}><input type="checkbox" checked={answers.skills.includes(skill)} onChange={() => updateList('skills', skill)} />{skill}</label>)}</div></fieldset>
    <label className="form-field">Other skills you have tried <span className="field-note">Optional, separated by commas</span><input maxLength={300} value={answers.otherSkills} onChange={(event) => setAnswers({ ...answers, otherSkills: event.target.value })} placeholder="For example, Figma or public speaking" /></label>
    <label className="form-field">What would you like to work toward?<select value={answers.goal} onChange={(event) => setAnswers({ ...answers, goal: event.target.value })}><option value="explore career options">Explore career options</option><option value="build a project">Build a project</option><option value="prepare for internships">Prepare for internships</option><option value="develop technical skills">Develop technical skills</option></select></label>
    <label className="form-field">How many hours can you learn in a typical week? <span className="field-note">Optional</span><select value={answers.weeklyAvailability} onChange={(event) => setAnswers({ ...answers, weeklyAvailability: event.target.value })}><option value="">Skip for now</option><option value="1">About 1 hour</option><option value="2">About 2 hours</option><option value="4">About 4 hours</option><option value="6">About 6 hours</option><option value="10">About 10 hours</option><option value="15">15 or more hours</option></select></label>
    <Notice>Only your selected learning preferences are sent to the configured guidance service. Your results are saved on this device. Career suggestions are guidance, not a guarantee of employment or a scientifically validated assessment.</Notice>
    <div className="form-actions"><Button disabled={loading}>{loading ? 'Building your suggestions…' : 'Get my career suggestions'} {!loading && <ArrowRight size={16} />}</Button><Link className="text-link" to="/career">Not ready yet? Browse career tools</Link></div>
    {loading && <div className="loading-inline" role="status" aria-live="polite">Putting together your learning directions and next steps…</div>}
    {error && <div className="assessment-error"><Notice tone="error">{error}</Notice><Button type="button" variant="subtle" disabled={loading} onClick={() => submit()}><RefreshCw size={15} /> Try again</Button></div>}
  </form></>;
}

export function CareerResultsPage() {
  const { quizResult } = usePlatform();
  if (!quizResult) return <><PageTitle eyebrow="YOUR SUGGESTIONS" title="A direction to explore." description="Start with a few questions to get personalized ideas for what to explore next." /><EmptyState icon={Compass} title="Start with a few questions" description="Your career suggestions appear here after the interest assessment." action={<Link className="ui-button ui-button-primary" to="/career/assessment">Take the assessment</Link>} /></>;
  if (quizResult.recommendations) {
    const plan = quizResult.recommendations;
    return <><PageTitle eyebrow={quizResult.mode === 'ai' ? 'AI-ASSISTED IDEAS' : 'DEMO EXPLORATION IDEAS'} title="A few directions to explore." description={plan.summary} actions={<Badge tone={quizResult.mode === 'ai' ? 'success' : 'demo'}>{quizResult.mode === 'ai' ? 'AI-assisted suggestions' : 'Demo suggestions · not AI-generated'}</Badge>} />
      <Notice tone={quizResult.persistenceError ? 'error' : 'info'}>{quizResult.disclaimer || 'These career ideas are guidance, not guarantees of employment or a scientifically validated assessment.'} {quizResult.persistence === 'account' ? 'Saved to your account.' : quizResult.persistenceError ? `${quizResult.persistenceError} The plan is saved on this device only.` : 'Saved on this device only.'}</Notice>
      <section className="recommendation-directions" aria-labelledby="directions-heading"><div className="block-heading"><div><span className="eyebrow">POSSIBLE DIRECTIONS</span><h2 id="directions-heading">Compare, then try one</h2></div></div><div className="recommendation-grid">{plan.directions.map((direction) => <Card key={direction.title}><span className="career-icon"><Compass size={20} /></span><h3>{direction.title}</h3><p>{direction.whyFit}</p><span className="eyebrow">FOUNDATIONAL SKILLS</span><div className="skill-tags">{direction.foundationalSkills.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div></Card>)}</div></section>
      <section className="recommendation-section" aria-labelledby="roadmap-heading"><span className="eyebrow">YOUR FLEXIBLE LEARNING ROADMAP</span><h2 id="roadmap-heading">Small stages, at your pace</h2><div className="recommendation-roadmap">{plan.roadmap.map((stage, index) => <Card key={`${stage.stage}-${index}`}><span className="eyebrow">STAGE {index + 1}</span><h3>{stage.stage}</h3><p>{stage.focus}</p><ul>{stage.activities.map((activity) => <li key={activity}>{activity}</li>)}</ul></Card>)}</div></section>
      <div className="recommendation-grid recommendation-followups"><Card><span className="eyebrow">PRACTICAL PROJECTS</span><h2>Learn by making</h2><ul>{plan.projects.map((item) => <li key={item}>{item}</li>)}</ul></Card><Card><span className="eyebrow">PORTFOLIO IMPROVEMENTS</span><h2>Show what you can do</h2><ul>{plan.portfolioImprovements.map((item) => <li key={item}>{item}</li>)}</ul></Card><Card><span className="eyebrow">INTERVIEW PRACTICE</span><h2>Tell your story</h2><ul>{plan.interviewTasks.map((item) => <li key={item}>{item}</li>)}</ul></Card></div>
      <Card className="recommendation-next"><span className="eyebrow">YOUR SUGGESTED NEXT ACTION</span><h2>{plan.nextAction}</h2><div className="detail-actions"><Link className="ui-button ui-button-primary" to="/career/roadmap">Open your roadmap <ArrowRight size={16} /></Link><Link className="ui-button ui-button-subtle" to="/guidance">Ask a follow-up question</Link></div></Card>
      <div className="form-actions"><Link className="text-link" to="/career/assessment">Retake assessment</Link><Link className="text-link" to="/career/skills">Check skill gaps <ArrowRight size={15} /></Link></div>
    </>;
  }
  const career = careerData[quizResult.career] || careerData['data-analyst'];
  return <><PageTitle eyebrow="SUGGESTIONS, NOT A LABEL" title="A direction to explore." description={quizResult.summary} /><Card className="recommendation-card"><div className={`career-icon ${career.color}`}><Target /></div><span className="eyebrow">YOUR STARTING IDEA</span><h2>{career.title}</h2><p>Try one beginner-friendly project and see whether the work feels interesting. You can change direction whenever you learn something new.</p><div className="skill-tags">{career.skills.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div><div className="detail-actions"><Link className="ui-button ui-button-primary" to={`/learning/${career.course}`}>Explore a related path <ArrowRight size={16} /></Link><Link className="ui-button ui-button-subtle" to="/career/skills">Check skill gaps</Link></div></Card><div className="form-actions"><Link className="text-link" to="/career/assessment">Retake assessment</Link><Link className="text-link" to="/career/roadmap">Plan a next step <ArrowRight size={15} /></Link></div></>;
}

export function SkillGapPage() {
  const { quizResult, goals, addGoal } = usePlatform();
  const roleKey = quizResult?.career || 'data-analyst';
  const [career, setCareer] = useState(roleKey);
  const [selected, setSelected] = useState([]);
  const [goalMessage, setGoalMessage] = useState('');
  const target = careerData[career];
  const gaps = target.skills.filter((skill) => !selected.includes(skill));
  const toggle = (skill) => setSelected((old) => old.includes(skill) ? old.filter((item) => item !== skill) : [...old, skill]);
  const save = () => {
    const newGoals = gaps.slice(0, 3)
      .map((skill) => `Explore ${skill} for ${target.title.toLowerCase()}`)
      .filter((goal) => !goals.includes(goal));
    newGoals.forEach(addGoal);
    setGoalMessage(newGoals.length ? `${newGoals.length} skill ${newGoals.length === 1 ? 'goal' : 'goals'} added to your dashboard.` : 'Those suggested skill goals are already on your dashboard.');
  };
  return <><PageTitle eyebrow="A FRIENDLY SKILL CHECK" title="See what you could learn next." description="Choose a role and check the skills you have already tried. This is a planning aid, not a hiring assessment." /><div className="form-panel"><label className="form-field">Role to explore<select value={career} onChange={(event) => { setCareer(event.target.value); setSelected([]); setGoalMessage(''); }}>{Object.entries(careerData).map(([id, role]) => <option value={id} key={id}>{role.title}</option>)}</select></label><div className="skill-check-grid"><fieldset><legend>Skills you&apos;ve practiced</legend>{target.skills.map((skill) => <label className="check-row" key={skill}><input type="checkbox" checked={selected.includes(skill)} onChange={() => toggle(skill)} /><span>{skill}</span></label>)}</fieldset><Card className="gap-summary"><span className="eyebrow">YOUR CURRENT SNAPSHOT</span><h2>{selected.length} of {target.skills.length} skills selected</h2><ProgressBar value={Math.round(selected.length / target.skills.length * 100)} label="Skills you have practiced" /><p>Skills to explore next: {gaps.length ? gaps.join(', ') : 'You have selected all the suggested skills.'}</p><Button onClick={save} disabled={!gaps.length}><Plus size={15} />Add skills as learning goals</Button>{goalMessage && <Notice tone="success">{goalMessage}</Notice>}</Card></div></div><div className="career-tools-grid"><Card><span className="eyebrow">KEEP IT PRACTICAL</span><h2>Skills grow through practice.</h2><p>Try a small project, ask someone for feedback, and keep a note of what you learned. You don&apos;t need to master everything before moving forward.</p></Card><Card><span className="eyebrow">RELATED LEARNING</span><h2>Explore one topic</h2><p>Choose a guided path to get a gentle introduction to the skills you want to build.</p><Link className="text-link" to={`/learning/${target.course}`}>View a related path <ArrowRight size={15} /></Link></Card></div></>;
}

export function RoadmapPage() {
  const { quizResult, goals, addGoal, removeGoal, roadmapDone: done, toggleRoadmapStep } = usePlatform();
  const role = careerData[quizResult?.career] || careerData['data-analyst'];
  const roleTitle = quizResult?.recommendations?.directions?.[0]?.title || role.title;
  const recommendedSteps = quizResult?.recommendations?.roadmap;
  const relatedRole = Object.values(careerData).find((candidate) => candidate.title === roleTitle) || role;
  const steps = recommendedSteps?.map((stage) => ({
    title: stage.stage,
    detail: `${stage.focus} ${stage.activities.join(' ')}`,
  })) || [
    { title: 'Explore the role', detail: 'Read about a typical day and note what sounds interesting.' },
    { title: 'Build one foundation', detail: `Choose a short learning path connected to ${role.skills[0]}.` },
    { title: 'Make a small project', detail: 'Use what you practiced to create or explain something useful.' },
    { title: 'Share and reflect', detail: 'Ask for feedback and note one thing you would improve next time.' },
  ];
  const addRoadmap = () => addGoal(`Explore a project for ${roleTitle.toLowerCase()}`);
  return <><PageTitle eyebrow="YOUR ROADMAP" title="A path you can take at your pace." description={`A flexible ${recommendedSteps ? 'personalized' : 'starter'} roadmap for exploring ${roleTitle.toLowerCase()}. Adjust it as your interests grow.`} /><Card className="roadmap-summary"><div><span className="eyebrow">YOUR PROGRESS</span><h2>{done.length} of {steps.length} steps explored</h2><ProgressBar value={Math.round(done.length / steps.length * 100)} label="Roadmap progress" /></div><Button variant="subtle" onClick={addRoadmap}><Plus size={15} />Add a project goal</Button></Card><div className="roadmap-list">{steps.map((step, index) => <Card className={`roadmap-step ${done.includes(index) ? 'completed' : ''}`} key={step.title}><button className="roadmap-check" aria-label={`${done.includes(index) ? 'Mark incomplete' : 'Mark complete'}: ${step.title}`} aria-pressed={done.includes(index)} onClick={() => toggleRoadmapStep(index)}>{done.includes(index) ? <Check size={17} /> : index + 1}</button><div><span className="eyebrow">STEP {index + 1}</span><h2>{step.title}</h2><p>{step.detail}</p>{index === 1 && <Link className="text-link" to={`/learning/${relatedRole.course}`}>View a related learning path <ArrowRight size={14} /></Link>}</div><Badge tone={done.includes(index) ? 'success' : 'default'}>{done.includes(index) ? 'Explored' : 'When you’re ready'}</Badge></Card>)}</div><Card className="personal-goals"><span className="eyebrow">YOUR LEARNING GOALS</span><h2>Small steps that matter to you</h2>{goals.map((goal) => <p key={goal}><Target size={15} />{goal}<button aria-label={`Remove goal: ${goal}`} onClick={() => removeGoal(goal)}><Check size={14} /></button></p>)}</Card></>;
}

const interviewQuestions = [
  { question: 'Tell me about a project or task you enjoyed working on.', hint: 'Use a simple story: the situation, what you tried, and what you learned.' },
  { question: 'How do you approach a problem you have not seen before?', hint: 'Share how you break a problem into steps, ask questions, and check your approach.' },
  { question: 'What is one skill you are currently learning?', hint: 'Explain what sparked your interest and how you practice.' },
];

export function InterviewPage() {
  const [index, setIndex] = useState(0);
  const { account, interviewNotes, saveInterviewNotes } = usePlatform();
  const question = interviewQuestions[index];
  const [answer, setAnswer] = useState(interviewNotes[question.question] || '');
  const [showHint, setShowHint] = useState(false);
  const [practiceSaved, setPracticeSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const save = async () => {
    setPracticeSaved(false);
    setSaveError('');
    if (await saveInterviewNotes(question.question, answer)) setPracticeSaved(true);
    else setSaveError('Your practice notes were not saved. Please try again.');
  };
  const changeQuestion = (next) => {
    setIndex(next);
    setAnswer(interviewNotes[interviewQuestions[next].question] || '');
    setShowHint(false);
    setPracticeSaved(false);
    setSaveError('');
  };
  return <><PageTitle eyebrow="PRACTICE WITHOUT PRESSURE" title="Build confidence one answer at a time." description="These practice prompts are for learning and reflection. There is no score and no single right answer." /><Card className="interview-card"><div className="question-count">QUESTION {index + 1} OF {interviewQuestions.length}</div><h2>{question.question}</h2><label className="form-field" htmlFor="practice-answer">Draft your answer<textarea id="practice-answer" rows="7" maxLength="1200" value={answer} onChange={(event) => { setAnswer(event.target.value); setPracticeSaved(false); setSaveError(''); }} placeholder="Take a breath, then write a few notes..." /></label><div className="character-count">{answer.length}/1200</div><div className="detail-actions"><Button variant="subtle" onClick={() => setShowHint(!showHint)}>{showHint ? 'Hide hint' : 'Show a helpful hint'}</Button><Button onClick={save} disabled={answer.trim().length < 10}>Save my practice notes <Check size={15} /></Button></div>{showHint && <Notice>{question.hint}</Notice>}{practiceSaved && <Notice tone="success">Practice notes saved {account ? 'to your account' : 'on this device'}. Try saying your answer out loud next.</Notice>}{saveError && <Notice tone="error">{saveError}</Notice>}<div className="question-navigation"><Button variant="subtle" disabled={index === 0} onClick={() => changeQuestion(index - 1)}><ChevronLeft size={16} />Previous</Button><Button variant="subtle" onClick={() => changeQuestion((index + 1) % interviewQuestions.length)}>Next question <ChevronRight size={16} /></Button></div></Card></>;
}

export function GuidancePage() {
  const [message, setMessage] = useState('');
  const [interests, setInterests] = useState('');
  const [messages, setMessages] = useState([]);
  const [failedPrompt, setFailedPrompt] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [copyError, setCopyError] = useState('');
  const lastMessageRef = useRef(null);
  useEffect(() => {
    lastMessageRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading]);
  const sendMessage = async (prompt = message, retryId = null) => {
    const trimmed = prompt.trim();
    if (trimmed.length < 3 || loading) return;
    const id = retryId || `${Date.now()}-${Math.random()}`;
    const context = messages.filter((item) => item.id !== retryId).slice(-6);
    if (!retryId) {
      setMessages((old) => [...old, { id, role: 'user', content: trimmed }]);
      setMessage('');
    }
    setLoading(true);
    setError('');
    setCopyError('');
    try {
      const response = await apiFetch('/api/guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          message: trimmed,
          history: context.slice(-4).map(({ role, content }) => ({ role, content: content.slice(-400) })),
          interests: interests.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8).map((item) => item.slice(0, 80)),
          experience: 'beginner',
        }),
      });
      const result = await parseApiResponse(response, 'Guidance service is unavailable.');
      if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('The guidance service returned an empty reply. Please retry.');
      setMessages((old) => [...old, { id: `${Date.now()}-${Math.random()}`, role: 'assistant', content: result.answer, mode: result.mode }]);
      setFailedPrompt(null);
    } catch (requestError) {
      setError(requestError instanceof TypeError ? 'We could not reach the guidance service. Check your connection and retry.' : requestError.message);
      setFailedPrompt({ id, prompt: trimmed });
    } finally {
      setLoading(false);
    }
  };
  const copyAnswer = async (item) => {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopiedId(item.id);
      setCopyError('');
    } catch {
      setCopyError('Could not copy this reply. You can select and copy its text instead.');
    }
  };
  const suggestedQuestions = [
    'I am new to programming. What should I learn first?',
    'How can I build a beginner data analytics project?',
    'How do I prepare for an internship interview?',
    'What should I include in my portfolio?',
  ];
  return <><PageTitle eyebrow="A SUPPORTIVE PLACE TO START" title="Ask SkillBridge." description="Get practical, beginner-friendly ideas for careers, learning skills, projects, and interviews." /><div className="guidance-layout"><Card className="guidance-intro"><span className="tool-icon"><MessageCircle size={20} /></span><h2>A helpful starting point, not a final answer.</h2><p>Ask about choosing a career, programming, data, web development, AI, internships, portfolios, or interviews. Guidance is educational; it cannot guarantee a career or employment outcome.</p><p>Only send details that are useful to your question. Do not include passwords, private contact details, or sensitive personal information.</p><Notice>Messages are held in this page session only and are not saved by SkillBridge. Your question and selected interests are sent to the configured guidance provider; check that provider&apos;s privacy and retention terms. Demo replies are deterministic and are not AI-generated.</Notice></Card><section className="guidance-chat" aria-label="SkillBridge career guidance chat">
    <div className="chat-suggestions"><div className="chat-suggestions-heading"><span className="eyebrow">TRY ASKING</span><button className="chat-clear" type="button" disabled={!messages.length || loading} onClick={() => { setMessages([]); setError(''); setFailedPrompt(null); setCopiedId(''); }}>Clear conversation</button></div><div>{suggestedQuestions.map((question) => <button key={question} type="button" disabled={loading} onClick={() => sendMessage(question)}>{question}</button>)}</div></div>
    <div className="chat-transcript" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
      {!messages.length && <div className="chat-empty"><span className="chat-avatar assistant"><Sparkles size={16} /></span><div><b>SkillBridge</b><p>Hi! Tell me what you are curious about, and we can break it into a practical next step.</p></div></div>}
      {messages.map((item) => <article className={`chat-message ${item.role}`} key={item.id}><span className={`chat-avatar ${item.role}`}>{item.role === 'user' ? <UserRound size={16} /> : <Sparkles size={16} />}</span><div className="chat-message-content"><div className="chat-message-heading"><b>{item.role === 'user' ? 'You' : 'SkillBridge'}</b>{item.mode && <Badge tone={item.mode === 'ai' ? 'success' : 'demo'}>{item.mode === 'ai' ? 'AI-assisted' : 'Demo · not AI-generated'}</Badge>}</div><p>{item.content}</p>{item.role === 'assistant' && <button className="chat-copy" type="button" onClick={() => copyAnswer(item)} aria-label="Copy SkillBridge response"><Copy size={14} />{copiedId === item.id ? 'Copied' : 'Copy response'}</button>}</div></article>)}
      {loading && <div className="chat-message assistant" role="status" aria-live="polite"><span className="chat-avatar assistant"><Sparkles size={16} /></span><div className="chat-message-content"><b>SkillBridge is thinking</b><div className="chat-typing" aria-label="Generating a response"><i /><i /><i /></div></div></div>}
      <div ref={lastMessageRef} />
    </div>
    {error && <div className="chat-error"><Notice tone="error">{error}</Notice>{failedPrompt && <Button variant="subtle" disabled={loading} onClick={() => sendMessage(failedPrompt.prompt, failedPrompt.id)}><RefreshCw size={15} /> Retry response</Button>}</div>}
    {copyError && <Notice tone="error">{copyError}</Notice>}
    <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}><label className="form-field" htmlFor="guidance-message">Your question<textarea id="guidance-message" required minLength={3} maxLength={1200} rows="3" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="How can I get started learning web development?" /></label><label className="form-field" htmlFor="guidance-interests">Interests <span className="field-note">Optional, comma-separated</span><input id="guidance-interests" maxLength={300} value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Design, data, helping people..." /></label><div className="chat-composer-footer"><span className="field-note">{message.length}/1200 · Conversation is not saved</span><Button disabled={loading || message.trim().length < 3}>{loading ? 'Thinking…' : 'Send question'} {!loading && <Send size={15} />}</Button></div></form>
  </section></div></>;
}

export function OpportunityCatalogPage() {
  const { items, source, loading } = useCatalog('opportunities');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [location, setLocation] = useState('All');
  const categories = ['All', ...new Set(items.map((job) => job.category))];
  const filtered = items.filter((job) => (category === 'All' || job.category === category) && (location === 'All' || job.location.toLowerCase().includes(location.toLowerCase())) && `${job.title} ${job.company} ${job.description} ${job.skills.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageTitle eyebrow="EXPLORE WITH CARE" title="Opportunities to learn about." description="Explore early-career role profiles from the catalog and practice tracking your next steps." actions={<SourceNote source={source} />} /><OpportunityNote /><div className="catalog-controls"><SearchBox value={search} onChange={setSearch} placeholder="Search roles, companies, or skills..." /><label className="filter-select">Location<select aria-label="Filter by location" value={location} onChange={(event) => setLocation(event.target.value)}><option>All</option><option>Remote</option><option>Hybrid</option></select></label></div><div className="filter-chips">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>{loading && <div className="skeleton-grid"><i /><i /><i /></div>}{!loading && filtered.length > 0 && <div className="opportunity-grid">{filtered.map((job) => <OpportunityCard key={job.id} job={job} />)}</div>}{!loading && !filtered.length && <EmptyState icon={Search} title="No roles match those filters" description="Try clearing a filter or using a shorter search." action={<Button variant="subtle" onClick={() => { setSearch(''); setCategory('All'); setLocation('All'); }}>Clear filters</Button>} />}</>;
}

export function OpportunityDetailPage() {
  const { opportunityId } = useParams();
  const { items } = useCatalog('opportunities');
  const job = items.find((item) => item.id === opportunityId);
  const { account, savedOpportunities, toggleOpportunity, applications, trackApplication } = usePlatform();
  if (!job) return <><PageTitle eyebrow="OPPORTUNITIES" title="Listing not found." description="This listing may have changed or been removed." /><EmptyState icon={BriefcaseBusiness} title="Opportunity not found" description="Browse role examples to find another one." action={<Link className="ui-button ui-button-primary" to="/opportunities">Browse opportunities</Link>} /></>;
  return <><PageTitle eyebrow="LISTING · NOT VERIFIED" title={job.title} description={`${job.company} · ${job.location}`} /><OpportunityNote /><div className="detail-layout opportunity-detail"><div><Card className="course-overview"><div className="badge-row"><Badge>{job.category}</Badge><Badge tone="demo">Not verified</Badge></div><h2>About this role profile</h2><p>{job.description}</p><h2>Skills to explore</h2><div className="skill-tags">{job.skills.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div><div className="detail-actions"><Button variant="subtle" onClick={() => toggleOpportunity(job.id)}><Bookmark size={15} fill={savedOpportunities.includes(job.id) ? 'currentColor' : 'none'} />{savedOpportunities.includes(job.id) ? 'Saved' : 'Save for later'}</Button><Link className="ui-button ui-button-subtle" to="/career/skills">Check your skills <ArrowRight size={15} /></Link></div></Card><Card><span className="eyebrow">PREPARE THOUGHTFULLY</span><h2>Before applying anywhere</h2><ul className="plain-list"><li>Verify the role on the official company site.</li><li>Review the role requirements and your questions.</li><li>Never pay to apply or share passwords.</li></ul></Card></div><aside className="detail-sidebar"><Card><span className="eyebrow">APPLICATION TRACKER</span><h2>Your next step</h2><p>Tracking does not submit an application. {account && isDatabaseId(job.id) ? 'Your status is saved to your account.' : 'This status is saved on this device.'}</p><label className="form-field">Status<select value={applications[job.id] || ''} onChange={(event) => trackApplication(job.id, event.target.value)}><option value="">Not started</option><option value="interested">Interested</option><option value="preparing">Preparing to apply</option><option value="applied">Applied</option><option value="interviewing">Interviewing</option><option value="accepted">Accepted</option><option value="rejected">Not selected</option><option value="withdrawn">Withdrawn</option></select></label></Card></aside></div></>;
}

export function SavedPage() {
  const { savedCourses, savedOpportunities } = usePlatform();
  const { items: courseItems, source: courseSource } = useCatalog('courses');
  const { items: opportunityItems, source: opportunitySource } = useCatalog('opportunities');
  const courses = courseItems.filter((course) => savedCourses.includes(course.id));
  const opportunities = opportunityItems.filter((job) => savedOpportunities.includes(job.id));
  return <><PageTitle eyebrow="YOUR SHORTLIST" title="Saved for later." description="Keep paths and opportunity examples together while you decide what to explore." /><section className="saved-section"><div className="block-heading"><div><span className="eyebrow">LEARNING</span><h2>Saved paths</h2></div><SourceNote source={courseSource} /></div>{courses.length ? <div className="catalog-grid">{courses.map((course) => <CourseCard key={course.id} course={course} source={courseSource} />)}</div> : <EmptyState icon={GraduationCap} title="No saved paths yet" description="Use the bookmark control on a learning path to save it here." action={<Link className="ui-button ui-button-primary" to="/learning">Explore paths</Link>} />}</section><section className="saved-section"><div className="block-heading"><div><span className="eyebrow">OPPORTUNITIES</span><h2>Saved opportunities</h2></div><SourceNote source={opportunitySource} /></div><OpportunityNote />{opportunities.length ? <div className="opportunity-grid">{opportunities.map((job) => <OpportunityCard key={job.id} job={job} />)}</div> : <EmptyState icon={BriefcaseBusiness} title="No saved opportunities yet" description="Save an opportunity example to find it again here." action={<Link className="ui-button ui-button-primary" to="/opportunities">Explore opportunities</Link>} />}</section></>;
}

export function ProfilePage() {
  const { user } = useOutletContext();
  const [name, setName] = useState(user?.name || '');
  const [interests, setInterests] = useState((user?.interests || []).join(', '));
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');
  const [weeklyHours, setWeeklyHours] = useState(user?.weekly_learning_hours ? String(user.weekly_learning_hours) : '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setName(user?.name || '');
    setInterests((user?.interests || []).join(', '));
    setBio(user?.bio || '');
    setLocation(user?.location || '');
    setWeeklyHours(user?.weekly_learning_hours ? String(user.weekly_learning_hours) : '');
  }, [user]);
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setMessage('');
    try {
      const response = await apiFetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, interests: interests.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8), bio, location, weekly_learning_hours: weeklyHours ? Number(weeklyHours) : null }) });
      const result = await parseApiResponse(response, 'Could not update your profile.');
      setName(result.user.name);
      setMessage('Profile updated.');
      window.dispatchEvent(new Event('skillbridge:auth-updated'));
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Account service is unavailable. Profile updates need a connection.' : error.message);
    } finally { setLoading(false); }
  };
  return <><PageTitle eyebrow="YOUR ACCOUNT" title="Profile & settings." description="Manage your name, learning interests, and optional learning preferences." /><form className="form-panel profile-form" onSubmit={submit}><label className="form-field">Name<input required minLength={1} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="form-field">Email address<input type="email" disabled value={user?.email || 'Sign in to manage your email'} /></label><label className="form-field">Learning interests <span className="field-note">Separate topics with commas</span><input maxLength={500} value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Data, design, web development" /></label><label className="form-field">Short bio <span className="field-note">Optional</span><textarea maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} /></label><label className="form-field">Location <span className="field-note">Optional; city or region only</span><input maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} /></label><label className="form-field">Learning hours each week <span className="field-note">Optional</span><select value={weeklyHours} onChange={(event) => setWeeklyHours(event.target.value)}><option value="">Not specified</option>{[1, 2, 4, 6, 10, 15, 20, 30, 40].map((hours) => <option value={hours} key={hours}>{hours}{hours === 40 ? '+' : ''} hours</option>)}</select></label><Button disabled={loading || !user}>{loading ? 'Saving…' : 'Save changes'} <Check size={15} /></Button>{message && <Notice tone={message === 'Profile updated.' ? 'success' : 'error'}>{message}</Notice>}{!user && <Notice>Sign in with an available API connection to save profile changes. Demo learning progress remains on this device.</Notice>}</form></>;
}

export function AuthPage({ mode }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const register = mode === 'register';
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await apiFetch(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      await parseApiResponse(response, 'Account service is unavailable.');
      window.dispatchEvent(new Event('skillbridge:auth-updated'));
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError instanceof TypeError ? 'Account service is unavailable. Please try again later.' : requestError.message);
    } finally { setLoading(false); }
  };
  return <div className="auth-page"><span className="quizlogo"><GraduationCap /></span><PageTitle eyebrow="YOUR SKILLBRIDGE ACCOUNT" title={register ? 'Create your account.' : 'Welcome back.'} description="Your account is handled securely by the SkillBridge server." /><form className="form-panel auth-page-form" onSubmit={submit}>{register && <label className="form-field">Your name<input autoComplete="name" required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>}<label className="form-field">Email address<input type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="form-field">Password<input type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={10} maxLength={128} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><span className="field-note">Use at least 10 characters.</span></label><Button disabled={loading}>{loading ? 'Please wait…' : register ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></Button>{error && <Notice tone="error">{error}</Notice>}<p className="auth-switch">{register ? 'Already have an account?' : 'New to SkillBridge?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p><Link className="text-link" to="/forgot-password">Forgot your password?</Link></form></div>;
}

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  return <><PageTitle eyebrow="ACCOUNT HELP" title="Password reset." description="Password recovery needs a verified email service, which is not configured in this demo." /><Card className="policy-card"><span className="tool-icon"><CircleCheck size={20} /></span><h2>No reset email will be sent</h2><p>To protect your account, we don&apos;t display or change passwords in the browser. Ask your platform administrator to configure and verify a recovery email service before using password resets.</p>{submitted && <Notice>Thanks. This demo cannot send a reset email yet.</Notice>}<form className="inline-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}><label className="form-field">Account email<input type="email" required maxLength={254} placeholder="you@example.com" /></label><Button>Request reset link</Button></form><Link className="text-link" to="/login">Back to sign in</Link></Card></>;
}

export function ContactPage() {
  const { user } = useOutletContext();
  const [form, setForm] = useState({ email: '', message: '', category: 'general' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSubmitted(false);
    try {
      const response = await apiFetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, email: form.email || undefined }),
      });
      await parseApiResponse(response, 'Could not submit feedback.');
      setSubmitted(true);
      setForm({ email: '', message: '', category: 'general' });
    } catch (requestError) {
      setError(requestError instanceof TypeError ? 'Feedback service is unavailable. Your message was not submitted.' : requestError.message);
    } finally {
      setLoading(false);
    }
  };
  return <><PageTitle eyebrow="CONTACT & FEEDBACK" title="Have a thought to share?" description="Feedback is sent securely to the SkillBridge backend. Share only information needed to understand your note." /><form className="form-panel contact-route-form" onSubmit={submit}><label className="form-field">Topic<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="general">General feedback</option><option value="bug">Report a problem</option><option value="course">Learning paths</option><option value="career">Career guidance</option><option value="opportunity">Opportunities</option></select></label><label className="form-field">Email address <span className="field-note">{user ? 'Optional; only include it if you want a reply' : 'Required when you are signed out'}</span><input type="email" maxLength={254} required={!user} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="form-field">Your message<textarea required minLength={10} maxLength={3000} rows="5" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label><Button disabled={loading}>{loading ? 'Submitting…' : 'Submit feedback'} {!loading && <ArrowRight size={15} />}</Button>{submitted && <Notice tone="success">Feedback submitted successfully.</Notice>}{error && <Notice tone="error">{error}</Notice>}</form></>;
}

export function AboutPage() {
  return <><PageTitle eyebrow="ABOUT SKILLBRIDGE" title="Your potential is real." description="SkillBridge is a student-first learning and career guidance platform concept." /><div className="policy-card"><h2>Our approach</h2><p>Clear information, practical learning, and encouraging guidance can help people take confident steps toward their goals. We aim to keep the experience useful for people who are new to technology, avoid promises about career outcomes, and make the next learning step feel achievable.</p><div className="career-tools-grid"><Card><h2>Learn with purpose</h2><p>Build skills in small steps and practice through projects.</p></Card><Card><h2>Explore with curiosity</h2><p>Use career suggestions as ideas to investigate, not labels.</p></Card><Card><h2>Move with care</h2><p>Verify opportunities and protect your personal information.</p></Card></div></div></>;
}

export function LegalPage({ type }) {
  const privacy = type === 'privacy';
  return <><PageTitle eyebrow="SKILLBRIDGE" title={privacy ? 'Privacy overview.' : 'Terms of service.'} description="Plain-language prototype information. Have these reviewed before launching a public service." /><div className="policy-card"><h2>{privacy ? 'What this demo stores' : 'Using this prototype'}</h2><p>{privacy ? 'Learning bookmarks, progress, interview notes, goals, and generated career-assessment results are stored in local browser storage on this device. Chat conversation history stays in the guidance page memory only and is cleared when you leave or refresh the page; SkillBridge does not save it. When configured, the server sends your question, bounded conversation context, and selected assessment preferences to the AI provider. Account names, email addresses, and passwords are not sent to that provider. Review its privacy and retention terms, and do not enter sensitive personal details.' : 'This is an educational prototype, not a source of verified courses, vacancies, professional advice, or guaranteed career outcomes. Sample opportunities are illustrative. Verify claims and details with official sources before acting.'}</p><h2>{privacy ? 'Your choices' : 'Safety and availability'}</h2><p>{privacy ? 'You can clear locally saved demo progress and assessment results through your browser storage. Account data deletion, privacy requests, data retention rules, and provider-specific handling must be implemented and documented before production.' : 'The application may be unavailable, incomplete, or contain demo content. The contact and password-reset flows do not send messages or email. Use the platform at your own discretion and do not submit secrets or sensitive data.'}</p><p>Last updated: October 2026. This page is informational and is not legal advice.</p></div></>;
}

export function AdminPage() {
  const { user } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState('');
  const [course, setCourse] = useState({ title: '', description: '', category: '', level: 'Beginner', duration_weeks: 4 });
  const [job, setJob] = useState({ company: '', title: '', category: '', location: '', description: '', application_url: '' });
  const loadSummary = async () => {
    const response = await apiFetch('/api/admin/summary');
    const result = await parseApiResponse(response, 'Could not load admin information.');
    setSummary(result);
  };
  useEffect(() => {
    if (user?.role === 'admin') loadSummary().catch((error) => setMessage(error.message));
  }, [user?.role]);
  const submit = async (event, endpoint, payload, reset) => {
    event.preventDefault(); setMessage('');
    try {
      const response = await apiFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      await parseApiResponse(response, 'Could not save this item.');
      setMessage('Catalog item created.');
      window.dispatchEvent(new Event('skillbridge:catalog-updated'));
      reset();
      await loadSummary();
    } catch (error) { setMessage(error.message); }
  };
  if (user?.role !== 'admin') return <><PageTitle eyebrow="ADMINISTRATION" title="Administrator access required." description="This area is restricted. Sign in with an administrator account to continue." /><Notice tone="error">Administrator permissions are verified by the server, not by this page.</Notice><Link className="ui-button ui-button-primary" to="/login">Sign in</Link></>;
  return <><PageTitle eyebrow="ADMINISTRATION" title="Manage the learning catalog." description="Create courses and illustrative opportunities. Server-side role checks protect these actions." actions={<Button variant="subtle" onClick={() => loadSummary().catch((error) => setMessage(error.message))}>Refresh counts</Button>} />{summary && <div className="dashboard-metrics"><Card><span className="eyebrow">ACCOUNTS</span><strong>{summary.users}</strong></Card><Card><span className="eyebrow">COURSES</span><strong>{summary.courses}</strong></Card><Card><span className="eyebrow">OPPORTUNITIES</span><strong>{summary.opportunities}</strong></Card></div>}<div className="admin-forms"><form className="form-panel" onSubmit={(event) => submit(event, '/api/admin/courses', { ...course, duration_weeks: Number(course.duration_weeks) }, () => setCourse({ title: '', description: '', category: '', level: 'Beginner', duration_weeks: 4 }))}><span className="eyebrow">COURSE CATALOG</span><h2>Add a course</h2><AdminCourseFields value={course} onChange={setCourse} /><Button>Create course <Plus size={15} /></Button></form><form className="form-panel" onSubmit={(event) => submit(event, '/api/admin/opportunities', job, () => setJob({ company: '', title: '', category: '', location: '', description: '', application_url: '' }))}><span className="eyebrow">OPPORTUNITY CATALOG</span><h2>Add an opportunity</h2><AdminJobFields value={job} onChange={setJob} /><Button>Create opportunity <Plus size={15} /></Button></form></div>{message && <Notice tone={message.includes('created') ? 'success' : 'error'}>{message}</Notice>}</>;
}

function AdminCourseFields({ value, onChange }) {
  return <><label className="form-field">Course title<input required minLength={3} maxLength={160} value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} /></label><label className="form-field">Description<textarea required minLength={10} maxLength={2000} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} /></label><label className="form-field">Category<input required minLength={2} maxLength={80} value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value })} /></label><label className="form-field">Level<select value={value.level} onChange={(event) => onChange({ ...value, level: event.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label><label className="form-field">Duration in weeks<input required type="number" min="1" max="52" value={value.duration_weeks} onChange={(event) => onChange({ ...value, duration_weeks: event.target.value })} /></label></>;
}

function AdminJobFields({ value, onChange }) {
  return <><label className="form-field">Company<input required minLength={2} maxLength={120} value={value.company} onChange={(event) => onChange({ ...value, company: event.target.value })} /></label><label className="form-field">Role title<input required minLength={3} maxLength={160} value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} /></label><label className="form-field">Category<input required minLength={2} maxLength={80} value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value })} /></label><label className="form-field">Location<input required minLength={2} maxLength={120} value={value.location} onChange={(event) => onChange({ ...value, location: event.target.value })} /></label><label className="form-field">Description<textarea required minLength={10} maxLength={2000} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} /></label><label className="form-field">Official application URL<input type="url" required maxLength={1000} value={value.application_url} onChange={(event) => onChange({ ...value, application_url: event.target.value })} /></label></>;
}
