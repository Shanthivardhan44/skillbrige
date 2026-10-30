import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ArrowRight, Compass } from 'lucide-react';
import App from './App.jsx';
import { AppShell } from './AppShell.jsx';
import {
  AboutPage, AdminPage, AssessmentPage, AuthPage, CareerPage, CareerResultsPage,
  ContactPage, CourseDetailPage, DashboardPage, ForgotPasswordPage, GuidancePage,
  InterviewPage, LearningCatalogPage, LegalPage, LessonPage, OpportunityCatalogPage,
  OpportunityDetailPage, ProfilePage, RoadmapPage, SavedPage, SkillGapPage,
} from './pages.jsx';
import { PlatformProvider } from './platform.js';

function NotFoundPage() {
  return <section className="not-found"><span className="quizlogo"><Compass /></span><span className="eyebrow">PAGE NOT FOUND</span><h1>This path is still unexplored.</h1><p>The page may have moved. You can head back to your dashboard or browse learning paths.</p><div className="detail-actions"><Link className="ui-button ui-button-primary" to="/dashboard">Go to dashboard <ArrowRight size={16} /></Link><Link className="ui-button ui-button-subtle" to="/learning">Explore learning paths</Link></div></section>;
}

export default function SkillBridgeRouter() {
  return <BrowserRouter><PlatformProvider><Routes>
    <Route path="/" element={<App />} />
    <Route element={<AppShell />}>
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="learning" element={<LearningCatalogPage />} />
      <Route path="learning/:courseId" element={<CourseDetailPage />} />
      <Route path="learning/:courseId/lessons/:lessonId" element={<LessonPage />} />
      <Route path="career" element={<CareerPage />} />
      <Route path="career/assessment" element={<AssessmentPage />} />
      <Route path="career/results" element={<CareerResultsPage />} />
      <Route path="career/skills" element={<SkillGapPage />} />
      <Route path="career/roadmap" element={<RoadmapPage />} />
      <Route path="career/interview" element={<InterviewPage />} />
      <Route path="guidance" element={<GuidancePage />} />
      <Route path="opportunities" element={<OpportunityCatalogPage />} />
      <Route path="opportunities/:opportunityId" element={<OpportunityDetailPage />} />
      <Route path="saved" element={<SavedPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="login" element={<AuthPage mode="login" />} />
      <Route path="register" element={<AuthPage mode="register" />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="contact" element={<ContactPage />} />
      <Route path="about" element={<AboutPage />} />
      <Route path="privacy" element={<LegalPage type="privacy" />} />
      <Route path="terms" element={<LegalPage type="terms" />} />
      <Route path="admin" element={<AdminPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes></PlatformProvider></BrowserRouter>;
}
