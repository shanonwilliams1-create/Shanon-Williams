import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import ProspectTracker from './pages/ProspectTracker.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';
import AttorneyLogin from './pages/attorney/AttorneyLogin.jsx';
import AttorneyVerify from './pages/attorney/AttorneyVerify.jsx';
import AttorneyDashboard from './pages/attorney/AttorneyDashboard.jsx';
import SetPassword from './pages/attorney/SetPassword.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<ProspectTracker />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/attorney/login" element={<AttorneyLogin />} />
        <Route path="/attorney/verify" element={<AttorneyVerify />} />
        <Route path="/attorney/dashboard" element={<AttorneyDashboard />} />
        <Route path="/attorney/set-password" element={<SetPassword />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
