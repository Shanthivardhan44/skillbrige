import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api.js';

export const courseCatalog = [
  { id: 'data-analytics', title: 'Data Analytics Foundations', category: 'Data', level: 'Beginner', duration: '4 weeks', durationWeeks: 4, description: 'Turn raw data into useful stories with SQL, spreadsheets, and dashboards.', skills: ['Spreadsheets', 'SQL', 'Data visualization'], color: 'blue', lessons: ['Start with a useful question', 'Make sense of a spreadsheet', 'Write your first SQL query', 'Share a clear insight'] },
  { id: 'full-stack', title: 'Full-Stack Web Development', category: 'Development', level: 'Beginner', duration: '8 weeks', durationWeeks: 8, description: 'Build responsive websites and practical apps from front end to back end.', skills: ['HTML & CSS', 'JavaScript', 'React'], color: 'violet', lessons: ['How the web works', 'Build a page with HTML', 'Style a page with CSS', 'Add interactions with JavaScript', 'Create a React interface'] },
  { id: 'ai-machine-learning', title: 'AI & Machine Learning', category: 'AI & ML', level: 'Intermediate', duration: '6 weeks', durationWeeks: 6, description: 'Explore datasets, models, and the ideas behind intelligent applications.', skills: ['Python', 'Statistics', 'Machine learning'], color: 'pink', lessons: ['AI in everyday products', 'Explore a small dataset', 'Learn what a model does', 'Build a responsible demo'] },
  { id: 'python-problem-solving', title: 'Python for Problem Solving', category: 'Development', level: 'Beginner', duration: '3 weeks', durationWeeks: 3, description: 'Grow your programming confidence through hands-on Python challenges.', skills: ['Python', 'Problem solving', 'Testing'], color: 'orange', lessons: ['Python and your first program', 'Store information in variables', 'Make decisions with code', 'Solve a small challenge'] },
  { id: 'interview-readiness', title: 'Interview Readiness Lab', category: 'Career', level: 'All levels', duration: '2 weeks', durationWeeks: 2, description: 'Practice communication, technical interviews, and project storytelling.', skills: ['Communication', 'Project stories', 'Interview practice'], color: 'green', lessons: ['Understand the interview format', 'Tell a project story', 'Practice common questions'] },
  { id: 'sql-visualization', title: 'SQL & Data Visualization', category: 'Data', level: 'Intermediate', duration: '4 weeks', durationWeeks: 4, description: 'Query datasets and communicate insights with clear visualizations.', skills: ['SQL', 'Dashboards', 'Data storytelling'], color: 'cyan', lessons: ['Review a real-world question', 'Filter and group data', 'Create a clear chart', 'Explain a finding'] },
];

export const opportunityCatalog = [
  { id: 'northstar', company: 'Northstar Labs', title: 'Frontend Developer Intern', category: 'Web Development', location: 'Remote · 8 weeks', level: 'Entry level', description: 'Illustrative frontend internship profile for practicing how to evaluate a role. Confirm availability and details directly with an employer before applying.', skills: ['HTML & CSS', 'JavaScript', 'Communication'], color: 'blue' },
  { id: 'brightpath', company: 'BrightPath Insights', title: 'Data Analyst Intern', category: 'Data Analytics', location: 'Hybrid · 10 weeks', level: 'Entry level', description: 'Illustrative data internship profile for exploring common requirements and application preparation.', skills: ['Spreadsheets', 'SQL', 'Data visualization'], color: 'violet' },
  { id: 'futuremind', company: 'FutureMind Studio', title: 'AI Research Intern', category: 'AI & ML', location: 'Remote · 12 weeks', level: 'Early career', description: 'Illustrative AI research internship profile; this is not a verified or active vacancy.', skills: ['Python', 'Statistics', 'Research'], color: 'pink' },
];

const initialState = {
  savedCourses: [],
  savedOpportunities: [],
  enrollments: {},
  applications: {},
  quizResult: null,
  goals: ['Complete one short lesson this week', 'Write down two career questions'],
  activity: [],
  roadmapDone: [],
  interviewNotes: {},
};

export const isDatabaseId = (id) => /^[0-9a-f]{24}$/i.test(String(id));

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem('skillbridge-platform') || '{}');
    const previousCourses = JSON.parse(localStorage.getItem('skillbridge-courses') || '[]');
    const previousOpportunities = JSON.parse(localStorage.getItem('skillbridge-opportunities') || '[]');
    const previousEnrollments = JSON.parse(localStorage.getItem('skillbridge-enrollments') || '{}');
    const courseIdsByTitle = Object.fromEntries(courseCatalog.map((course) => [course.title, course.id]));
    const migratedEnrollments = Object.fromEntries(Object.entries(previousEnrollments)
      .filter(([title]) => courseIdsByTitle[title])
      .map(([title, progress]) => [courseIdsByTitle[title], Array.from(
        { length: Math.min(courseCatalog.find((course) => course.title === title).lessons.length, Math.floor(Number(progress) / 25)) },
        (_value, index) => index,
      )]));
    const restored = {
      ...initialState,
      ...saved,
      savedCourses: saved.savedCourses || previousCourses.map((title) => courseIdsByTitle[title]).filter(Boolean),
      savedOpportunities: saved.savedOpportunities || previousOpportunities,
      enrollments: saved.enrollments || migratedEnrollments,
    };
    restored.goals = [...new Set(Array.isArray(restored.goals)
      ? restored.goals.filter((goal) => typeof goal === 'string')
      : initialState.goals)];
    return restored;
  } catch (error) {
    console.warn('Could not restore SkillBridge learning data.', error);
    return initialState;
  }
}

const PlatformContext = createContext(null);

export function PlatformProvider({ children }) {
  const [state, setState] = useState(readState);
  const [account, setAccount] = useState(null);
  const [syncingAccount, setSyncingAccount] = useState(true);
  const [actionNotice, setActionNotice] = useState(null);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const refreshAccount = async () => {
      const currentRequest = ++requestId;
      const isCurrent = () => active && currentRequest === requestId;
      setSyncingAccount(true);
      try {
        const response = await apiFetch('/api/auth/me');
        if (response.status === 401) {
          if (isCurrent()) {
            setAccount(null);
            setState(readState());
            setActionNotice(null);
          }
          return;
        }
        if (!response.ok) throw new Error('Could not check the account session.');
        const result = await response.json();
        if (!isCurrent()) return;
        setAccount(result.user);
        const dashboardResponse = await apiFetch('/api/me/dashboard');
        if (!dashboardResponse.ok) throw new Error('Could not load your saved learning data.');
        const dashboard = await dashboardResponse.json();
        if (!isCurrent()) return;
        setState((old) => ({
          ...old,
          savedCourses: dashboard.savedCourses,
          savedOpportunities: dashboard.savedOpportunities,
          enrollments: Object.fromEntries(dashboard.enrollments.map((item) => [item.course_id, item.completed_lesson_ids])),
          applications: dashboard.applications,
        }));
        const practiceResponse = await apiFetch('/api/me/interview-practice');
        if (!practiceResponse.ok) throw new Error('Could not load your interview practice notes.');
        const practice = await practiceResponse.json();
        if (!isCurrent()) return;
        setState((old) => ({
          ...old,
          interviewNotes: Object.fromEntries(practice.sessions.map((item) => [item.question, item.answer_notes])),
        }));
        const assessmentResponse = await apiFetch('/api/career-assessments/latest');
        if (assessmentResponse.ok) {
          const assessment = await assessmentResponse.json();
          if (isCurrent()) {
            setState((old) => ({
              ...old,
              quizResult: {
                mode: assessment.mode,
                recommendations: assessment.recommendations,
                disclaimer: assessment.disclaimer,
                persistence: 'account',
                assessmentId: String(assessment.assessment.id),
                roadmapId: assessment.roadmapId,
                roadmapMilestones: assessment.milestones,
              },
              roadmapDone: assessment.milestones.flatMap((milestone, index) => milestone.completed ? [index] : []),
            }));
          }
        } else if (assessmentResponse.status !== 404) {
          throw new Error('Could not load your latest career plan.');
        }
        if (isCurrent()) setActionNotice(null);
      } catch (error) {
        if (isCurrent() && error.name !== 'AbortError') setActionNotice({ tone: 'error', message: `${error.message} Your demo tools remain available.` });
      } finally {
        if (isCurrent()) setSyncingAccount(false);
      }
    };
    refreshAccount();
    window.addEventListener('skillbridge:auth-updated', refreshAccount);
    return () => {
      active = false;
      window.removeEventListener('skillbridge:auth-updated', refreshAccount);
    };
  }, []);

  useEffect(() => {
    try {
      const localState = account
        ? {
          ...state,
          savedCourses: state.savedCourses.filter((id) => !isDatabaseId(id)),
          savedOpportunities: state.savedOpportunities.filter((id) => !isDatabaseId(id)),
          enrollments: Object.fromEntries(Object.entries(state.enrollments).filter(([id]) => !isDatabaseId(id))),
          applications: Object.fromEntries(Object.entries(state.applications).filter(([id]) => !isDatabaseId(id))),
          interviewNotes: {},
          quizResult: state.quizResult?.persistence === 'account' ? null : state.quizResult,
          roadmapDone: state.quizResult?.persistence === 'account' ? [] : state.roadmapDone,
        }
        : state;
      localStorage.setItem('skillbridge-platform', JSON.stringify(localState));
    } catch (error) {
      console.error('Could not save SkillBridge learning data.', error);
    }
  }, [state, account]);

  const value = useMemo(() => {
    const logActivity = (label) => {
      setState((old) => ({ ...old, activity: [label, ...old.activity].slice(0, 6) }));
    };
    const updateNotice = (tone, message) => setActionNotice({ tone, message });
    const request = async (path, method, body) => {
      try {
        const response = await apiFetch(path, {
          method,
          ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
        });
        if (!response.ok) {
          let result;
          try { result = await response.json(); } catch { result = null; }
          throw new Error(result?.error || 'The server could not save that change.');
        }
        return true;
      } catch (error) {
        updateNotice('error', error instanceof TypeError ? 'The account service is unavailable. Your change was not saved.' : error.message);
        return false;
      }
    };
    const toggle = async (key, id, label, endpoint) => {
      const current = state[key].includes(id);
      const syncToAccount = account && isDatabaseId(id);
      if (syncToAccount && !(await request(`${endpoint}/${encodeURIComponent(id)}`, current ? 'DELETE' : 'PUT'))) return false;
      setState((old) => {
        const values = old[key].includes(id) ? old[key].filter((value) => value !== id) : [...old[key], id];
        return { ...old, [key]: values, activity: [`${values.includes(id) ? 'Saved' : 'Removed'} ${label}`, ...old.activity].slice(0, 6) };
      });
      updateNotice(syncToAccount ? 'success' : 'info', syncToAccount ? `${label === 'a learning path' ? 'Learning path' : 'Opportunity'} ${current ? 'removed from' : 'added to'} your saved items.` : `${label === 'a learning path' ? 'Learning path' : 'Opportunity'} saved on this device.`);
      return true;
    };
    return {
      ...state,
      account,
      syncingAccount,
      actionNotice,
      dismissActionNotice: () => setActionNotice(null),
      toggleCourse: (id) => toggle('savedCourses', id, 'a learning path', '/api/me/saved-courses'),
      toggleOpportunity: (id) => toggle('savedOpportunities', id, 'an opportunity', '/api/me/saved-opportunities'),
      enroll: async (id) => {
        if (Object.hasOwn(state.enrollments, id)) return true;
        const syncToAccount = account && isDatabaseId(id);
        if (syncToAccount && !(await request(`/api/courses/${encodeURIComponent(id)}/enrollments`, 'POST', {}))) return false;
        setState((old) => {
          if (Object.hasOwn(old.enrollments, id)) return old;
          return { ...old, enrollments: { ...old.enrollments, [id]: [] }, activity: [`Started ${courseCatalog.find((course) => course.id === id)?.title || 'a learning path'}`, ...old.activity].slice(0, 6) };
        });
        updateNotice(syncToAccount ? 'success' : 'info', syncToAccount ? 'Enrollment saved to your account.' : 'Learning path started on this device.');
        return true;
      },
      completeLesson: async (courseId, lessonId) => {
        const done = state.enrollments[courseId] || [];
        if (done.includes(lessonId)) return true;
        const syncToAccount = account && isDatabaseId(courseId);
        if (syncToAccount && !(await request(`/api/courses/${encodeURIComponent(courseId)}/progress`, 'POST', { lessonId: String(lessonId) }))) return false;
        setState((old) => {
          const previous = old.enrollments[courseId] || [];
          if (previous.includes(lessonId)) return old;
          return { ...old, enrollments: { ...old.enrollments, [courseId]: [...previous, lessonId] }, activity: [`Completed a lesson in ${courseCatalog.find((course) => course.id === courseId)?.title || 'a learning path'}`, ...old.activity].slice(0, 6) };
        });
        updateNotice(syncToAccount ? 'success' : 'info', syncToAccount ? 'Lesson progress saved to your account.' : 'Lesson progress saved on this device.');
        return true;
      },
      trackApplication: async (id, status) => {
        const previous = state.applications[id];
        if (!status && !previous) return true;
        const syncToAccount = account && isDatabaseId(id);
        const succeeded = syncToAccount
          ? await request(`/api/me/applications/${encodeURIComponent(id)}`, status ? 'PUT' : 'DELETE', status ? { status, notes: '' } : null)
          : true;
        if (!succeeded) return false;
        setState((old) => {
          const applications = { ...old.applications };
          if (status) applications[id] = status;
          else delete applications[id];
          return { ...old, applications, activity: [`Updated an application: ${status || 'not started'}`, ...old.activity].slice(0, 6) };
        });
        updateNotice(syncToAccount ? 'success' : 'info', syncToAccount ? 'Application status saved to your account.' : 'Application status saved on this device.');
        return previous !== status || !syncToAccount;
      },
      setQuizResult: (result) => setState((old) => ({ ...old, quizResult: result })),
      addGoal: (goal) => setState((old) => old.goals.includes(goal)
        ? old
        : { ...old, goals: [...old.goals, goal], activity: ['Added a learning goal', ...old.activity].slice(0, 6) }),
      removeGoal: (goal) => setState((old) => ({ ...old, goals: old.goals.filter((item) => item !== goal) })),
      toggleRoadmapStep: async (index) => {
        const milestones = state.quizResult?.roadmapMilestones || [];
        const milestone = milestones[index];
        const completed = !state.roadmapDone.includes(index);
        const syncToAccount = account && isDatabaseId(state.quizResult?.roadmapId) && isDatabaseId(milestone?.id);
        if (syncToAccount) {
          const saved = await request(`/api/roadmaps/${encodeURIComponent(state.quizResult.roadmapId)}/milestones/${encodeURIComponent(milestone.id)}`, 'PATCH', { completed });
          if (!saved) return false;
        }
        setState((old) => ({ ...old, roadmapDone: old.roadmapDone.includes(index) ? old.roadmapDone.filter((item) => item !== index) : [...old.roadmapDone, index] }));
        updateNotice(syncToAccount ? 'success' : 'info', syncToAccount ? 'Roadmap progress saved to your account.' : 'Roadmap progress saved on this device.');
        return true;
      },
      saveInterviewNotes: async (question, note) => {
        if (account && !(await request('/api/me/interview-practice', 'POST', { question, answer_notes: note }))) return false;
        setState((old) => ({ ...old, interviewNotes: { ...old.interviewNotes, [question]: note }, activity: ['Saved interview practice notes', ...old.activity].slice(0, 6) }));
        updateNotice(account ? 'success' : 'info', account ? 'Interview practice notes saved to your account.' : 'Interview practice notes saved on this device.');
        return true;
      },
      logActivity,
    };
  }, [state, account, syncingAccount, actionNotice]);

  return createElement(PlatformContext.Provider, { value }, children);
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) throw new Error('usePlatform must be used inside PlatformProvider');
  return context;
}

export function useCatalog(kind) {
  const fallback = kind === 'courses' ? courseCatalog : opportunityCatalog;
  const [data, setData] = useState({ items: fallback, source: 'demo', loading: true, error: '' });

  useEffect(() => {
    let controller;
    const loadCatalog = () => {
      controller?.abort();
      controller = new AbortController();
      apiFetch(`/api/${kind}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Could not load ${kind}.`);
        if (Array.isArray(result[kind]) && result[kind].length) {
          const items = result[kind].map((item) => normalizeCatalogItem(item, kind));
          const source = items.every((item) => item.is_demo) ? 'demo' : 'live';
          setData({ items, source, loading: false, error: '' });
        } else {
          setData({ items: fallback, source: 'demo', loading: false, error: '' });
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setData({ items: fallback, source: 'demo', loading: false, error: '' });
      });
    };
    loadCatalog();
    window.addEventListener('skillbridge:catalog-updated', loadCatalog);
    return () => {
      controller?.abort();
      window.removeEventListener('skillbridge:catalog-updated', loadCatalog);
    };
  }, [kind]);
  return data;
}

function normalizeCatalogItem(item, kind) {
  if (kind === 'courses') {
    const hasLessonData = Array.isArray(item.lessons);
    const lessons = hasLessonData ? item.lessons : [];
    return {
      ...item,
      id: String(item.id),
      duration: `${item.duration_weeks || item.durationWeeks || 4} weeks`,
      durationWeeks: item.duration_weeks || item.durationWeeks || 4,
      description: item.description,
      skills: item.skills || [],
      lessons: hasLessonData ? lessons.map((lesson) => typeof lesson === 'string' ? lesson : lesson.title) : ['Explore the course overview', 'Practice one useful skill', 'Reflect on what you learned'],
      lessonIds: lessons.filter((lesson) => typeof lesson === 'object').map((lesson) => String(lesson.id)),
      color: item.color || 'blue',
    };
  }
  return { ...item, id: String(item.id), color: item.color || 'violet', skills: item.skills || [], level: item.level || 'Entry level' };
}
