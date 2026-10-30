import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUpRight, BrainCircuit, LogIn, Menu, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { appNavigation, Breadcrumbs, Notice } from './components.jsx';
import { apiFetch } from './api.js';
import { courseCatalog, opportunityCatalog } from './platform.js';
import { usePlatform } from './platform.js';

const routeNames = {
  dashboard: 'Dashboard', learning: 'Learning paths', career: 'Career exploration',
  assessment: 'Career assessment', results: 'Your recommendations', skills: 'Skill-gap analysis',
  roadmap: 'Your roadmap', interview: 'Interview practice', guidance: 'AI guidance',
  opportunities: 'Opportunities', saved: 'Saved items', profile: 'Profile & settings',
  login: 'Sign in', register: 'Create account', contact: 'Contact & feedback',
  about: 'About SkillBridge', privacy: 'Privacy policy', terms: 'Terms of service',
  'forgot-password': 'Reset password', admin: 'Admin dashboard', lessons: 'Lessons',
};

export function AppShell() {
  const location = useLocation();
  const { actionNotice, dismissActionNotice } = usePlatform();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [user, setUser] = useState(null);
  const segments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = useMemo(() => {
    let path = '';
    return segments.map((segment, index) => {
      path += `/${segment}`;
      const current = routeNames[segment]
        || courseCatalog.find((course) => course.id === segment)?.title
        || opportunityCatalog.find((job) => job.id === segment)?.title
        || segment.replaceAll('-', ' ');
      return { label: current.charAt(0).toUpperCase() + current.slice(1), to: index < segments.length - 1 ? path : null };
    });
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const refreshUser = () => {
      const currentRequest = ++requestId;
      apiFetch('/api/auth/me')
        .then((response) => response.ok ? response.json() : null)
        .then((result) => { if (active && currentRequest === requestId) setUser(result?.user || null); })
        .catch(() => { if (active && currentRequest === requestId) setUser(null); });
    };
    refreshUser();
    window.addEventListener('skillbridge:auth-updated', refreshUser);
    return () => {
      active = false;
      window.removeEventListener('skillbridge:auth-updated', refreshUser);
    };
  }, []);

  const signOut = async () => {
    setAccountError('');
    try {
      const response = await apiFetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Could not sign out. Please try again.');
      setUser(null);
      setUserMenuOpen(false);
      window.dispatchEvent(new Event('skillbridge:auth-updated'));
    } catch (error) {
      setAccountError(error instanceof TypeError ? 'Account service is unavailable.' : error.message);
    }
  };

  return <div className="workspace">
    <header className="workspace-header">
      <Link to="/" className="brand"><span className="logo"><BrainCircuit /></span>skill<span>bridge.</span></Link>
      <div className="workspace-header-right">
        <Link to="/guidance" className="header-guidance"><span>Ask SkillBridge</span><ArrowUpRight size={15} /></Link>
        <div className="user-menu-wrap">
          <button className="user-menu-trigger" aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen(!userMenuOpen)}><span className="user-avatar">{user?.name?.slice(0, 1).toUpperCase() || 'L'}</span><span>{user?.name?.split(' ')[0] || 'Learner'}</span><ArrowDown size={14} /></button>
          {userMenuOpen && <div className="user-menu" role="menu"><Link role="menuitem" to="/profile">Profile & settings</Link><Link role="menuitem" to="/saved">Saved items</Link>{user ? <button role="menuitem" onClick={signOut}>Sign out</button> : <Link role="menuitem" to="/login"><LogIn size={14} /> Sign in</Link>}</div>}
        </div>
        <button className="workspace-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen}>{menuOpen ? <X /> : <Menu />}</button>
      </div>
    </header>
    <div className="workspace-layout">
      <aside className={`workspace-sidebar ${menuOpen ? 'workspace-sidebar-open' : ''}`} aria-label="Application navigation">
        {['Workspace', 'Career tools', 'Discover', 'Account'].map((section) => <div className="sidebar-section" key={section}><span className="sidebar-heading">{section}</span>{appNavigation.filter((item) => item.section === section).map((item) => {
          const Icon = item.icon;
          return <NavLink key={item.to} to={item.to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}><Icon size={17} /><span>{item.label}</span></NavLink>;
        })}</div>)}
        <div className="sidebar-promo"><span className="sidebar-promo-icon"><BrainCircuit size={18} /></span><b>A small step counts.</b><p>Choose one useful thing to learn today.</p><Link to="/learning">Explore paths <ArrowUpRight size={14} /></Link></div>
        <Link className="sidebar-home" to="/"><ArrowLeft size={15} /> Back to home</Link>
      </aside>
      <main className="workspace-main">
        {accountError && <p className="account-error" role="alert">{accountError}</p>}
        {actionNotice && <Notice tone={actionNotice.tone}>{actionNotice.message}<button className="notice-dismiss" onClick={dismissActionNotice} aria-label="Dismiss update message">Dismiss</button></Notice>}
        <Breadcrumbs parts={breadcrumbs} />
        <div className="workspace-content"><Outlet context={{ user }} /></div>
      </main>
    </div>
    {menuOpen && <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
  </div>;
}
