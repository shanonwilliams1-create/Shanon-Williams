import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import ProspectTracker from './pages/ProspectTracker.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<ProspectTracker />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
