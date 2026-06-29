import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Pages
import LandingPage from './pages/LandingPage';
import LoginForm from './pages/auth/LoginForm';
import SignUpForm from './pages/auth/SignUpForm';
import ForgotPassword from './pages/auth/ForgotPassword';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import LeadList from './pages/dashboard/LeadList';
import LeadDetail from './pages/dashboard/LeadDetail';
import OutreachHub from './pages/dashboard/OutreachHub';
import OperationsGuide from './pages/dashboard/OperationsGuide';
import CalendarView from './pages/dashboard/CalendarView';
import FollowUpTimeline from './pages/dashboard/FollowUpTimeline';
import ReviewManagement from './pages/dashboard/ReviewManagement';
import ReferralProgram from './pages/dashboard/ReferralProgram';
import SettingsPanel from './pages/dashboard/SettingsPanel';
import SubscriptionManager from './pages/SubscriptionManager';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/login" element={<LoginForm />} />
        <Route path="/auth/signup" element={<SignUpForm />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<LeadList />} />
          <Route path="leads" element={<LeadList />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="operations" element={<OperationsGuide />} />
          <Route path="outreach" element={<OutreachHub />} />
          <Route path="appointments" element={<CalendarView />} />
          <Route path="followups" element={<FollowUpTimeline />} />
          <Route path="reviews" element={<ReviewManagement />} />
          <Route path="referrals" element={<ReferralProgram />} />
          <Route path="settings" element={<SettingsPanel />} />
        </Route>

        <Route path="/subscription" element={<SubscriptionManager />} />
      </Routes>
    </Router>
  );
}

export default App;
