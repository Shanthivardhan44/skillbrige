import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, BrainCircuit, BriefcaseBusiness, Check, Code2,
  Compass, GraduationCap, Menu, Play, Search, Sparkles, Target, TrendingUp, X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from './api.js';
import { useCatalog, usePlatform } from './platform.js';

const paths = [
  { id: 'data-analytics', title: 'Data Analytics Foundations', category: 'Data', level: 'Beginner', duration: '4 weeks', icon: TrendingUp, desc: 'Turn raw data into useful stories with SQL, spreadsheets, and dashboards.', color: 'blue' },
  { id: 'full-stack', title: 'Full-Stack Web Development', category: 'Development', level: 'Beginner', duration: '8 weeks', icon: Code2, desc: 'Build responsive websites and practical apps from front end to back end.', color: 'violet' },
  { id: 'ai-machine-learning', title: 'AI & Machine Learning', category: 'AI & ML', level: 'Intermediate', duration: '6 weeks', icon: BrainCircuit, desc: 'Explore datasets, models, and the ideas behind intelligent applications.', color: 'pink' },
  { id: 'python-problem-solving', title: 'Python for Problem Solving', category: 'Development', level: 'Beginner', duration: '3 weeks', icon: Code2, desc: 'Grow your programming confidence through hands-on Python challenges.', color: 'orange' },
  { id: 'interview-readiness', title: 'Interview Readiness Lab', category: 'Career', level: 'All levels', duration: '2 weeks', icon: Target, desc: 'Practice communication, technical interviews, and project storytelling.', color: 'green' },
  { id: 'sql-visualization', title: 'SQL & Data Visualization', category: 'Data', level: 'Intermediate', duration: '4 weeks', icon: TrendingUp, desc: 'Query datasets and communicate insights with clear visualizations.', color: 'cyan' },
];

const jobs = [
  { id: 'northstar', initial: 'N', company: 'Northstar Labs', title: 'Frontend Developer Intern', category: 'Web Development', location: 'Remote · 8 weeks', color: 'blue' },
  { id: 'brightpath', initial: 'B', company: 'BrightPath Insights', title: 'Data Analyst Intern', category: 'Data Analytics', location: 'Hybrid · 10 weeks', color: 'violet' },
  { id: 'futuremind', initial: 'F', company: 'FutureMind Studio', title: 'AI Research Intern', category: 'AI & ML', location: 'Remote · 12 weeks', color: 'pink' },
];

async function readApiResponse(response, unavailableMessage) {
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(unavailableMessage);
  }
  if (!response.ok) throw new Error(result.error || unavailableMessage);
  return result;
}

export default function App() {
  const platform = usePlatform();
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('All');
  const [quiz, setQuiz] = useState(false);
  const [interest, setInterest] = useState('');
  const [level, setLevel] = useState('');
  const [goal, setGoal] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [form, setForm] = useState({ email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatReply, setChatReply] = useState(null);
  const [chatError, setChatError] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [accountServiceError, setAccountServiceError] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileInterests, setProfileInterests] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const { items: apiCourses } = useCatalog('courses');
  const { items: apiOpportunities } = useCatalog('opportunities');
  const learningPaths = useMemo(() => apiCourses.map((course) => {
    const design = paths.find((item) => item.title === course.title);
    return {
      ...design,
      ...course,
      desc: course.description || design?.desc || '',
      icon: design?.icon || GraduationCap,
      color: course.color || design?.color || 'blue',
    };
  }), [apiCourses]);
  const listedJobs = useMemo(() => apiOpportunities.map((job) => {
    const design = jobs.find((item) => item.title === job.title);
    return {
      ...design,
      ...job,
      initial: job.company?.slice(0, 1) || design?.initial || 'S',
      color: job.color || design?.color || 'violet',
    };
  }), [apiOpportunities]);
  const saved = learningPaths.filter((path) => platform.savedCourses.includes(path.id)).map((path) => path.title);
  const savedJobs = listedJobs.filter((job) => platform.savedOpportunities.includes(job.id)).map((job) => job.id);
  const enrolled = Object.fromEntries(learningPaths
    .filter((path) => Object.hasOwn(platform.enrollments, path.id))
    .map((path) => [path.title, path.lessons.length
      ? Math.round(platform.enrollments[path.id].length * 100 / path.lessons.length)
      : 0]));

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const refreshUser = () => {
      const currentRequest = ++requestId;
      return apiFetch('/api/auth/me')
      .then(async (response) => {
        if (response.status === 401) {
          if (active && currentRequest === requestId) setUser(null);
          return null;
        }
        if (!response.ok) throw new Error('Account service is unavailable. You can still explore the demo.');
        return response.json();
      })
      .then((result) => {
        if (result && active && currentRequest === requestId) {
          setUser(result.user);
          setProfileName(result.user.name);
          setProfileInterests((result.user.interests || []).join(', '));
        }
      })
      .catch(() => {
        if (active && currentRequest === requestId) setAccountServiceError('Account service is unavailable. You can still explore the demo.');
      });
    };
    refreshUser();
    window.addEventListener('skillbridge:auth-updated', refreshUser);
    return () => {
      active = false;
      window.removeEventListener('skillbridge:auth-updated', refreshUser);
    };
  }, []);

  useEffect(() => {
    if (!quiz && !authOpen) return undefined;
    const backdrop = document.querySelector('.backdrop');
    const focusable = backdrop?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]');
    const previousFocus = document.activeElement;
    focusable?.[0]?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setQuiz(false);
        setAuthOpen(false);
      }
      if (event.key === 'Tab' && focusable?.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, [quiz, authOpen]);

  const shown = useMemo(() => learningPaths.filter((path) =>
    (filter === 'All' || path.category === filter)
    && `${path.title} ${path.desc}`.toLowerCase().includes(search.toLowerCase())), [filter, search, learningPaths]);
  const shownJobs = useMemo(() => listedJobs.filter((job) =>
    jobFilter === 'All' || job.category === jobFilter), [jobFilter, listedJobs]);
  const enrolledPaths = learningPaths.filter((path) => Object.hasOwn(enrolled, path.title));

  const announce = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };
  const go = (id) => {
    setMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };
  const toggleSavedPath = async (title) => {
    const path = learningPaths.find((item) => item.title === title);
    if (!path) return;
    const wasSaved = platform.savedCourses.includes(path.id);
    if (!(await platform.toggleCourse(path.id))) return;
    announce(wasSaved ? 'Learning path removed from saved items.' : 'Learning path saved.');
  };
  const toggleSavedJob = async (id) => {
    const wasSaved = platform.savedOpportunities.includes(id);
    if (!(await platform.toggleOpportunity(id))) return;
    announce(wasSaved ? 'Opportunity removed from saved items.' : 'Opportunity saved.');
  };
  const enroll = async (title) => {
    const path = learningPaths.find((item) => item.title === title);
    if (!path) return;
    if (Object.hasOwn(platform.enrollments, path.id)) {
      announce('You are already learning this path.');
      return;
    }
    if (!(await platform.enroll(path.id))) return;
    announce('You’re enrolled. Your first step is ready below.');
    go('dashboard');
  };
  const updateProgress = async (title) => {
    const path = learningPaths.find((item) => item.title === title);
    if (!path) return;
    const completed = platform.enrollments[path.id] || [];
    if (completed.length >= path.lessons.length || !path.lessons.length) return;
    const lessonId = path.lessonIds?.[completed.length] ?? completed.length;
    if (!(await platform.completeLesson(path.id, lessonId))) return;
    announce(completed.length + 1 === path.lessons.length ? 'Path completed. Congratulations!' : 'Progress updated by one lesson.');
  };
  const recommend = () => {
    const match = interest === 'Data & patterns'
      ? 'Data Analytics Foundations'
      : interest === 'Building websites'
        ? 'Full-Stack Web Development'
        : interest === 'AI & intelligent tools'
          ? 'AI & Machine Learning'
          : 'Python for Problem Solving';
    const nextStep = level === 'I am just starting'
      ? 'Start with the fundamentals, then build one small project.'
      : 'Build a focused project and practice explaining your approach.';
    setRecommendation(`${match}|${nextStep}`);
  };
  const askAssistant = async (event) => {
    event.preventDefault();
    setChatLoading(true);
    setChatReply(null);
    setChatError('');
    try {
      const response = await apiFetch('/api/guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatMessage, interests: interest ? [interest] : [], experience: 'beginner' }),
      });
      const result = await readApiResponse(response, 'Guidance is unavailable right now.');
      setChatReply(result);
    } catch (error) {
      setChatError(error instanceof TypeError ? 'Unable to reach the guidance service.' : error instanceof Error ? error.message : 'Guidance is unavailable right now.');
    } finally {
      setChatLoading(false);
    }
  };
  const submitAuth = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const response = await apiFetch(`/api/auth/${authMode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authMode === 'register' ? authForm : { email: authForm.email, password: authForm.password }),
      });
      const result = await readApiResponse(response, 'Unable to reach the account service.');
      setUser(result.user);
      setAccountServiceError('');
      setProfileName(result.user.name);
      setProfileInterests((result.user.interests || []).join(', '));
      setAuthOpen(false);
      window.dispatchEvent(new Event('skillbridge:auth-updated'));
      setAuthForm({ name: '', email: '', password: '' });
      announce(authMode === 'register' ? 'Your account is ready.' : 'Welcome back.');
    } catch (error) {
      setAuthError(error instanceof TypeError ? 'Unable to reach the account service. Please try again later.' : error instanceof Error ? error.message : 'Unable to reach the account service.');
    } finally {
      setAuthLoading(false);
    }
  };
  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileMessage('');
    try {
      const response = await apiFetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName,
          interests: profileInterests.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8),
        bio: user.bio || '',
        location: user.location || '',
        weekly_learning_hours: user.weekly_learning_hours ?? null,
        }),
      });
      const result = await readApiResponse(response, 'Unable to update your profile.');
      setUser(result.user);
      window.dispatchEvent(new Event('skillbridge:auth-updated'));
      setProfileMessage('Profile updated.');
    } catch (error) {
      setProfileMessage(error instanceof TypeError ? 'Unable to reach the account service. Please try again later.' : error instanceof Error ? error.message : 'Unable to reach the account service.');
    }
  };
  const submitContact = async (event) => {
    event.preventDefault();
    setContactLoading(true);
    setContactError('');
    setSent(false);
    try {
      const response = await apiFetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'general', email: form.email || undefined, message: form.message }),
      });
      await readApiResponse(response, 'Could not submit feedback.');
      setSent(true);
      setForm({ email: '', message: '' });
    } catch (error) {
      setContactError(error instanceof TypeError ? 'Feedback service is unavailable. Your message was not submitted.' : error instanceof Error ? error.message : 'Your message was not submitted.');
    } finally {
      setContactLoading(false);
    }
  };
  const signOut = async () => {
    try {
      const response = await apiFetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Unable to sign out right now.');
      setUser(null);
      setProfileMessage('');
      window.dispatchEvent(new Event('skillbridge:auth-updated'));
      announce('You have signed out.');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Unable to reach the account service.');
    }
  };

  return (
    <div className="app">
      <div className="announcement"><Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE <span>— explore your path for free</span></div>
      <header>
        <nav className="nav wrap" aria-label="Main navigation">
          <a className="brand" href="#home"><span className="logo"><BrainCircuit /></span>skill<span>bridge.</span></a>
          <button className="menu" onClick={() => setMenu(!menu)} aria-label="Toggle navigation" aria-expanded={menu}>{menu ? <X /> : <Menu />}</button>
          <div className={`links ${menu ? 'open' : ''}`}>
            <Link onClick={() => setMenu(false)} to="/learning">Explore</Link>
            <Link onClick={() => setMenu(false)} to="/dashboard">My progress</Link>
            <Link onClick={() => setMenu(false)} to="/career">Career tools</Link>
            <Link onClick={() => setMenu(false)} to="/guidance">AI guidance</Link>
            <Link onClick={() => setMenu(false)} to="/opportunities">Opportunities</Link>
            <a onClick={() => setMenu(false)} href="#about">About</a>
            {user ? <button className="navbtn" onClick={() => go('dashboard')}>{user.name.split(' ')[0]} · My space</button> : <button className="navbtn" onClick={() => { setAuthMode('login'); setAuthOpen(true); }}>Sign in</button>}
            <button className="navbtn" onClick={() => setQuiz(true)}>Find my path <ArrowUpRight size={15} /></button>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero wrap" id="home">
          <div>
            <div className="eyebrow"><i /> YOUR FUTURE, MAPPED</div>
            <h1>Big dreams.<br /><em>Clear next steps.</em></h1>
            <p className="lead">Discover what you&apos;re good at, learn skills that matter, and find a path toward work you&apos;ll love. Your career journey doesn&apos;t have to be guesswork.</p>
            <div className="actions">
              <button className="primary" onClick={() => setQuiz(true)}>Find your career path <ArrowRight size={17} /></button>
              <button className="quiet" onClick={() => go('explore')}><span className="play"><Play size={12} fill="currentColor" /></span> Explore learning paths</button>
            </div>
            <div className="proof"><div className="avatars"><b>J</b><b>M</b><b>A</b><b>+</b></div><span><strong>Small steps create momentum.</strong><small>Start where you are. Grow from there.</small></span></div>
          </div>
          <div className="hero-art">
            <div className="orbital one" /><div className="orbital two" />
            <div className="floating top"><Sparkles /><span><b>Career clarity</b><small>One step at a time</small></span></div>
            <div className="journey">
              <small className="tiny">YOUR LEARNING JOURNEY</small><h3>Build your future <span>✦</span></h3><p>A path designed around you</p>
              {[['✓', 'Discover your interests', 'Know what energizes you', 'DONE'], ['⌘', 'Build useful skills', 'Learn by doing', 'NEXT'], ['↗', 'Explore opportunities', 'Put your skills to work', '']].map((step) => <div className="step" key={step[1]}><b className="stepicon">{step[0]}</b><span><strong>{step[1]}</strong><small>{step[2]}</small></span><label>{step[3]}</label></div>)}
              <div className="progresslabel">Journey progress <b>2 of 3</b></div><div className="progress"><i /></div>
            </div>
            <div className="floating bottom"><Target /><span><b>Made for your goals</b><small>Not one-size-fits-all</small></span></div>
            <span className="star s1">✳</span><span className="star s2">✦</span>
          </div>
        </section>

        <section className="trust wrap" aria-label="How SkillBridge helps">
          <div><Compass /><span><b>Find direction</b><small>Explore what fits you</small></span></div>
          <div><GraduationCap /><span><b>Learn with purpose</b><small>Skills for real goals</small></span></div>
          <div><BriefcaseBusiness /><span><b>Take the next step</b><small>Turn learning into action</small></span></div>
        </section>

        <section className="section wrap" id="explore">
          <div className="sectionhead"><div><div className="eyebrow">LEARN SOMETHING THAT MOVES YOU</div><h2>Find your <em>next skill.</em></h2><p>Curated starting points for the career you&apos;re working toward.</p></div><button className="textbtn" onClick={() => { setFilter('All'); setSearch(''); }}>View all paths <ArrowRight size={15} /></button></div>
          <div className="tools">
            <label className="search"><Search size={16} /><input aria-label="Search learning paths" placeholder="Search skills or learning paths..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <div className="filters" aria-label="Filter learning paths">{['All', ...new Set(learningPaths.map((path) => path.category))].map((category) => <button key={category} className={filter === category ? 'active' : ''} aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}</button>)}</div>
          </div>
          <div className="cards">{shown.map((path) => {
            const Icon = path.icon;
            const isSaved = saved.includes(path.title);
            return <article className="pathcard" key={path.title}>
              <div className="cardtop"><span className={`pathicon ${path.color}`}><Icon /></span><button className={`save ${isSaved ? 'saved' : ''}`} onClick={() => toggleSavedPath(path.title)} aria-label={`${isSaved ? 'Remove' : 'Save'} ${path.title}`} aria-pressed={isSaved}>{isSaved ? '♥' : '♡'}</button></div>
              <div className="meta">{path.category} · {path.level}</div><h3>{path.title}</h3><p>{path.desc}</p>
              <footer>{path.duration}<button onClick={() => enroll(path.title)} aria-label={`${enrolled[path.title] !== undefined ? 'Continue' : 'Start'} ${path.title}`}><ArrowUpRight size={17} /></button></footer>
            </article>;
          })}</div>
          {shown.length === 0 && <p className="empty" role="status">No learning paths found. Try a different search.</p>}
        </section>

        <section className="band" id="how">
          <div className="wrap bandinner"><div><div className="eyebrow light"><Sparkles size={14} /> A LITTLE CLARITY GOES A LONG WAY</div><h2>Not sure where to start?<br /><em>Let&apos;s figure it out together.</em></h2><p>Answer a few quick questions about what you enjoy and where you&apos;re starting from. Get a suggested learning direction and a practical next step.</p><button className="lightbtn" onClick={() => setQuiz(true)}>Take the 1-minute career quiz <ArrowRight size={16} /></button><small className="disclaimer">A starting point for exploration — not a formal career assessment.</small></div><div className="brainart"><div className="ring r1" /><div className="ring r2" /><div className="brain"><BrainCircuit size={58} /></div><span className="note n1">• Your interests</span><span className="note n2">• Your next step</span><span className="note n3">• Your pace</span></div></div>
        </section>

        <section className="section wrap" id="opportunities">
          <div className="sectionhead"><div><div className="eyebrow">PUT YOUR SKILLS INTO ACTION</div><h2>Open doors to <em>what&apos;s next.</em></h2><p>Explore example opportunities and the kinds of roles to look for.</p></div><span className="sample">SAMPLE LISTINGS</span></div>
          <div className="filters opportunity-filters" aria-label="Filter opportunities">{['All', ...new Set(listedJobs.map((job) => job.category))].map((category) => <button key={category} className={jobFilter === category ? 'active' : ''} aria-pressed={jobFilter === category} onClick={() => setJobFilter(category)}>{category}</button>)}</div>
          <div className="jobs">{shownJobs.map((job) => <article className="job" key={job.id}><div className={`company ${job.color}`}>{job.initial}</div><div className="jobbody"><span className="tag">{job.category}</span><h3>{job.title}</h3><p>{job.company}</p><footer><span>{job.location}</span><button onClick={() => toggleSavedJob(job.id)} aria-pressed={savedJobs.includes(job.id)}>{savedJobs.includes(job.id) ? 'Saved' : 'Save'} <ArrowUpRight size={14} /></button></footer></div></article>)}</div>
          <p className="notefoot">These are illustrative sample listings, not verified live vacancies. Confirm details on employers&apos; official career pages.</p>
        </section>

        <section className="section dashboard-section" id="dashboard">
          <div className="wrap">
            <div className="sectionhead"><div><div className="eyebrow">YOUR PERSONAL LEARNING SPACE</div><h2>Progress, <em>at your pace.</em></h2><p>{user ? 'Your account-backed learning and saved items are synchronized with the SkillBridge API.' : 'Your demo learning progress and saved items stay on this device.'}</p></div><button className="textbtn" onClick={() => go('explore')}>Find a learning path <ArrowRight size={15} /></button></div>
            <div className="dashboard-grid">
              <article className="dashboard-card"><span className="eyebrow">IN PROGRESS</span><strong className="stat">{enrolledPaths.length}</strong><p>learning {enrolledPaths.length === 1 ? 'path' : 'paths'}</p>              <div className="dashboard-list">{enrolledPaths.length ? enrolledPaths.map((path) => <div className="learning-item" key={path.title}><div><b>{path.title}</b><span>{enrolled[path.title]}% complete</span><div className="progress"><i style={{ width: `${enrolled[path.title]}%` }} /></div></div>{path.lessons.length ? <button className="progress-action" disabled={enrolled[path.title] === 100} onClick={() => updateProgress(path.title)}>{enrolled[path.title] === 100 ? 'Completed' : 'Mark next step done'}</button> : <span className="field-note">Lessons coming soon</span>}</div>) : <div className="dashboard-empty"><p>No learning paths yet. Choose one small step to get started.</p><button className="textbtn" onClick={() => go('explore')}>Explore paths <ArrowRight size={15} /></button></div>}</div></article>
              <article className="dashboard-card"><span className="eyebrow">SAVED FOR LATER</span><strong className="stat">{saved.length + savedJobs.length}</strong><p>saved paths and opportunities</p><div className="dashboard-list">{saved.length + savedJobs.length ? <>{saved.map((title) => <div className="saved-item" key={title}><span><GraduationCap size={16} />{title}</span><button onClick={() => enroll(title)}>Start learning</button></div>)}{savedJobs.map((id) => { const job = listedJobs.find((item) => item.id === id); return job ? <div className="saved-item" key={id}><span><BriefcaseBusiness size={16} />{job.title}</span><button onClick={() => go('opportunities')}>View listing</button></div> : null; })}</> : <div className="dashboard-empty"><p>Save a learning path or opportunity to keep it close.</p><button className="textbtn" onClick={() => go('explore')}>Browse paths <ArrowRight size={15} /></button></div>}</div></article>
            </div>
            <div className="profile-area">{user ? <form className="profile-card" onSubmit={saveProfile}><div><span className="eyebrow">YOUR ACCOUNT</span><h3>Profile & interests</h3><p>Update your name and the topics you want to explore. Your password is never shown here.</p></div><label>Name<input required minLength={1} maxLength={100} value={profileName} onChange={(event) => setProfileName(event.target.value)} /></label><label>Interests <small>Separate topics with commas</small><input maxLength={500} value={profileInterests} onChange={(event) => setProfileInterests(event.target.value)} placeholder="Data, design, web development" /></label><div className="profile-actions"><button className="primary" type="submit">Save profile</button><button className="quiet" type="button" onClick={signOut}>Sign out</button></div>{profileMessage && <p className={profileMessage === 'Profile updated.' ? 'success' : 'error'} role="status">{profileMessage}</p>}</form> : <div className="profile-card signed-out"><div><span className="eyebrow">SYNC YOUR ACCOUNT</span><h3>Keep your account details together.</h3><p>Sign in to update your profile. Learning progress and saved items on this demo remain on this device.</p>{accountServiceError && <p className="error" role="status">{accountServiceError}</p>}</div><button className="primary" onClick={() => { setAuthMode('register'); setAuthOpen(true); }}>Create a free account <ArrowRight size={16} /></button></div>}</div>
          </div>
        </section>

        <section className="section wrap assistant-section" id="assistant">
          <div className="assistant-panel"><div><div className="eyebrow light"><Sparkles size={14} /> A SUPPORTIVE PLACE TO START</div><h2>Ask SkillBridge.</h2><p>Get beginner-friendly ideas for what to learn next. You can ask a question without sharing personal details.</p><small>Not a professional counseling service. Guidance is general and should be checked against trusted sources.</small></div>
            <form className="assistant-form" onSubmit={askAssistant}><label htmlFor="assistant-question">What are you curious about?</label><textarea id="assistant-question" required minLength={3} maxLength={1200} rows="3" value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="For example: How could I start learning data analytics?" /><button className="primary full" disabled={chatLoading}>{chatLoading ? 'Thinking…' : 'Get guidance'} <ArrowRight size={16} /></button>{chatLoading && <p className="muted" role="status">Preparing a thoughtful response…</p>}{chatError && <p className="error" role="alert">{chatError} The assistant may be unavailable; please try again later.</p>}{chatReply && <div className="assistant-reply" role="status"><span className="eyebrow">{chatReply.mode === 'ai' ? 'AI-ASSISTED RESPONSE' : 'DEMO GUIDANCE — AI NOT CONFIGURED'}</span><p>{chatReply.answer}</p></div>}</form>
          </div>
        </section>

        <section className="about" id="about"><div className="wrap aboutgrid"><div className="aboutart"><div className="poster back" /><div className="poster front"><small>● THE SKILLBRIDGE APPROACH</small><h3>Learn.<br /><em>Build.</em><br />Become.</h3><hr /><p>Progress over perfection.<br />Curiosity over comparison.</p><GraduationCap /></div><div className="floatnote">✦ Made for learners<br /><b>at every starting point</b></div></div><div><div className="eyebrow">ABOUT SKILLBRIDGE</div><h2>Your potential is real.<br /><em>Let&apos;s make a plan.</em></h2><p>SkillBridge is a student-first learning and career guidance platform concept. We believe clear information, practical learning, and encouraging guidance can help people take confident steps toward their goals.</p><p>Whether you&apos;re choosing your first tech skill, building a portfolio, or preparing to explore internships, you deserve a starting point that feels achievable.</p><ul><li><Check /> Practical, project-minded learning</li><li><Check /> Guidance without the overwhelm</li><li><Check /> Progress at your own pace</li></ul><button className="textbtn" onClick={() => go('explore')}>Explore learning paths <ArrowRight size={15} /></button></div></div></section>

        <section className="section wrap" id="contact"><div className="contact"><div><div className="eyebrow light">YOUR NEXT CHAPTER STARTS HERE</div><h2>Have a goal in mind?</h2><p>Tell us what you&apos;re working toward. Let&apos;s make the next step feel a little clearer.</p><div className="contactpitch">✉ <span>Questions, ideas, or feedback?<br /><b>We&apos;d love to hear from you.</b></span></div></div><form onSubmit={submitContact}><label>Email address <small>{user ? 'Optional; only include it if you want a reply' : 'Required when you are signed out'}</small><input type="email" required={!user} maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="alex@example.com" /></label><label>What would you like help with?<textarea required minLength={10} maxLength={3000} rows="3" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="I'm interested in learning..." /></label><button className="primary full" disabled={contactLoading}>{contactLoading ? 'Sending…' : 'Send message'} {!contactLoading && <ArrowRight size={16} />}</button>{sent && <p className="success" role="status"><Check size={15} /> Feedback submitted.</p>}{contactError && <p className="error" role="alert">{contactError}</p>}</form></div></section>
      </main>

      <footer className="footer"><div className="wrap footmain"><a className="brand" href="#home"><span className="logo"><BrainCircuit /></span>skill<span>bridge.</span></a><p>Learn with purpose. Move with confidence.</p><div><Link to="/learning">Learning paths</Link><a href="#how">Career quiz</a><Link to="/guidance">AI guidance</Link><Link to="/opportunities">Opportunities</Link><Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div></div><div className="wrap footbottom"><span>© 2026 SkillBridge · Educational concept project</span><span>Built to help your next step feel possible ✦</span></div></footer>

      {toast && <div className="toast" role="status">{toast}</div>}
      {authOpen && <div className="backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setAuthOpen(false); setAuthError(''); } }}><section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="close" onClick={() => setAuthOpen(false)} aria-label="Close account form"><X /></button><span className="quizlogo"><BrainCircuit /></span><div className="eyebrow">YOUR SKILLBRIDGE ACCOUNT</div><h2 id="auth-title">{authMode === 'register' ? 'Create your account.' : 'Welcome back.'}</h2><p className="muted">Your account is managed securely by the SkillBridge API.</p><form className="auth-form" onSubmit={submitAuth}>{authMode === 'register' && <label>Your name<input autoComplete="name" required minLength={1} maxLength={100} value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} /></label>}<label>Email address<input type="email" autoComplete="email" required maxLength={254} value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} /></label><label>Password<input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} required minLength={10} maxLength={128} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} /><small>Use at least 10 characters.</small></label><button className="primary full" disabled={authLoading}>{authLoading ? 'Please wait…' : authMode === 'register' ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></button>{authError && <p className="error" role="alert">{authError}</p>}</form><button className="reset" onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setAuthError(''); }}>{authMode === 'register' ? 'Already have an account? Sign in' : 'New to SkillBridge? Create an account'}</button><p className="muted">This demo does not include password recovery. Your learning progress is currently stored on this device.</p></section></div>}
      {quiz && <div className="backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuiz(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="quiztitle"><button className="close" onClick={() => setQuiz(false)} aria-label="Close quiz"><X /></button><span className="quizlogo"><BrainCircuit /></span><div className="eyebrow">YOUR PERSONAL STARTING POINT</div><h2 id="quiztitle">Find a direction that fits.</h2><p className="muted">A quick reflection to help you choose what to explore first.</p>{!recommendation ? <div className="quizfields"><fieldset><legend>1. What sounds most interesting?</legend>{['Data & patterns', 'Building websites', 'AI & intelligent tools', 'Solving problems'].map((option) => <label className={`choice ${interest === option ? 'chosen' : ''}`} key={option}><input type="radio" name="interest" checked={interest === option} onChange={() => setInterest(option)} />{option}{interest === option && <Check size={15} />}</label>)}</fieldset><fieldset><legend>2. Where are you starting from?</legend>{['I am just starting', 'I have some experience'].map((option) => <label className={`choice ${level === option ? 'chosen' : ''}`} key={option}><input type="radio" name="level" checked={level === option} onChange={() => setLevel(option)} />{option}{level === option && <Check size={15} />}</label>)}</fieldset><label className="goal">3. What&apos;s your near-term goal?<select value={goal} onChange={(event) => setGoal(event.target.value)}><option value="">Choose a goal</option><option>Build a project</option><option>Prepare for internships</option><option>Explore career options</option><option>Strengthen fundamentals</option></select></label><button className="primary full" disabled={!interest || !level || !goal} onClick={recommend}>Show my starting point <ArrowRight size={16} /></button><small className="muted">This is a simple rule-based demo, not a connected AI model.</small></div> : <div className="result"><span className="eyebrow">YOUR SUGGESTED START</span><h3>{recommendation.split('|')[0]}</h3><p>{recommendation.split('|')[1]}</p><p className="goalresult"><b>Your goal</b><span>{goal}</span></p><button className="primary full" onClick={() => { enroll(recommendation.split('|')[0]); setQuiz(false); }}>Add this path to my progress <ArrowRight size={16} /></button><button className="reset" onClick={() => setRecommendation('')}>Change my answers</button><button className="reset" onClick={() => { setRecommendation(''); setInterest(''); setLevel(''); setGoal(''); }}>Retake quiz</button></div>}</section></div>}
    </div>
  );
}
