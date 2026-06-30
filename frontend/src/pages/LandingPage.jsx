/**
 * LandingPage — Public landing page
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Users, Search, BarChart, ArrowRight, Star } from 'lucide-react';
import IntakeChatWidget from '../components/IntakeChatWidget';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900">
      {/* Nav */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white text-sm">LF</div>
            <span className="font-semibold text-white text-lg">LeadForge</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/auth/login')} className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors">Sign In</button>
            <button onClick={() => navigate('/auth/signup')} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">Get Started</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
          Never Miss a<br />
          <span className="text-indigo-400">Construction Lead</span> Again
        </h1>
        <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
          LeadForge scans Facebook groups, job boards, permits, and more to find you projects before anyone else. Get real-time alerts and automated outreach.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => navigate('/auth/signup')} className="px-8 py-3.5 text-base font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/25">
            Start Free Trial <ArrowRight size={18} />
          </button>
          <button onClick={() => navigate('/auth/login')} className="px-8 py-3.5 text-base font-medium text-white/80 border border-white/20 rounded-xl hover:bg-white/5 transition-colors">
            Watch Demo
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Search, title: 'Smart Lead Detection', desc: 'AI-powered scanning of 6+ source types discovers projects the moment they\'re posted.' },
            { icon: Zap, title: 'Real-Time Alerts', desc: 'Get notified instantly via SMS, email, or in-app when a matching lead is found.' },
            { icon: Users, title: 'Automated Outreach', desc: 'Pre-built templates handle contact, booking, follow-ups, reviews, and referrals.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 hover:bg-white/10 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-4">
                <Icon size={24} className="text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing hint */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center border-t border-white/10">
        <p className="text-gray-400 text-sm">Start from $29/month — No per-lead fees. <button onClick={() => navigate('/auth/signup')} className="text-indigo-400 hover:underline">Start your free trial →</button></p>
      </section>
    </div>

    {/* Intake chat widget — floats on landing page for prospective clients */}
    <IntakeChatWidget />
  );
}