import { ArrowRight, BookOpen, BriefcaseBusiness, Check, ChevronRight, CircleHelp, Compass, GraduationCap, Home, LayoutDashboard, Map, MessageCircle, Search, Settings, Target } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`ui-button ${variant === 'primary' ? 'ui-button-primary' : `ui-button-${variant}`} ${className}`} {...props}>{children}</button>;
}

export function Badge({ children, tone = 'default' }) {
  return <span className={`ui-badge ${tone === 'default' ? '' : `ui-badge-${tone}`}`}>{children}</span>;
}

export function PageTitle({ eyebrow, title, description, actions, children }) {
  return <div className="page-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}{children}</div>{actions && <div className="page-title-actions">{actions}</div>}</div>;
}

export function EmptyState({ icon: Icon = CircleHelp, title, description, action }) {
  return <div className="empty-state"><span><Icon size={22} /></span><h2>{title}</h2><p>{description}</p>{action}</div>;
}

export function Notice({ children, tone = 'info' }) {
  return <div className={`ui-notice ui-notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Breadcrumbs({ parts }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/"><Home size={14} /> Home</Link>{parts.map((part, index) => <span key={part.label}><ChevronRight size={14} />{part.to && index < parts.length - 1 ? <Link to={part.to}>{part.label}</Link> : <span aria-current="page">{part.label}</span>}</span>)}</nav>;
}

export const appNavigation = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, section: 'Workspace' },
  { label: 'Learning paths', to: '/learning', icon: BookOpen, section: 'Workspace' },
  { label: 'Saved items', to: '/saved', icon: Check, section: 'Workspace' },
  { label: 'Explore careers', to: '/career', icon: Compass, section: 'Career tools' },
  { label: 'Skill-gap analysis', to: '/career/skills', icon: Target, section: 'Career tools' },
  { label: 'Career roadmap', to: '/career/roadmap', icon: Map, section: 'Career tools' },
  { label: 'Interview practice', to: '/career/interview', icon: MessageCircle, section: 'Career tools' },
  { label: 'Opportunities', to: '/opportunities', icon: BriefcaseBusiness, section: 'Discover' },
  { label: 'AI guidance', to: '/guidance', icon: CircleHelp, section: 'Discover' },
  { label: 'Profile & settings', to: '/profile', icon: Settings, section: 'Account' },
];

export function NextStep({ to, children }) {
  return <Link className="next-step" to={to}>{children}<ArrowRight size={16} /></Link>;
}

export function SourceNote({ source }) {
  return <Badge tone={source === 'live' ? 'success' : 'demo'}>{source === 'live' ? 'Catalog data from API' : 'Illustrative demo data'}</Badge>;
}

export function OpportunityNote() {
  return <Notice>Opportunity entries are not independently verified or confirmed active; some may be demo examples. Confirm role availability, employer identity, and application details on official employer channels before sharing personal information or applying.</Notice>;
}

export function ProgressBar({ value, label }) {
  const percentage = Math.max(0, Math.min(100, value));
  return <div className="progress-wrap"><div className="progress-meta"><span>{label}</span><b>{percentage}%</b></div><div className="progress-track" role="progressbar" aria-label={label} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percentage}%` }} /></div></div>;
}

export function SearchBox({ value, onChange, placeholder = 'Search...' }) {
  return <label className="app-search"><Search size={16} /><span className="visually-hidden">Search</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

export function Card({ className = '', children }) {
  return <article className={`ui-card ${className}`}>{children}</article>;
}

export function IconLabel({ icon: Icon = GraduationCap, children }) {
  return <span className="icon-label"><Icon size={15} />{children}</span>;
}
