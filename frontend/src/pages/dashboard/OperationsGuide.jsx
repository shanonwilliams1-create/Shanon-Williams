/**
 * OperationsGuide — How LeadForge works for contractors
 * Simple, visual setup guide. No jargon. Just steps.
 */
import React from 'react';
import {
  Wrench, MapPin, Search, Zap, Bell, Database,
  Globe, Facebook, MessageSquare, Star, Share2,
} from 'lucide-react';

const steps = [
  { icon: Wrench, title: '1. Pick Your Trades', desc: 'Select the kind of work you do — plumbing, electrical, roofing, etc. You\'ll only see leads that match.', color: 'bg-blue-500' },
  { icon: MapPin, title: '2. Set Your Areas', desc: 'Enter the zip codes where you work. The system scans for projects in those areas automatically.', color: 'bg-indigo-500' },
  { icon: Search, title: '3. Leads Start Flowing', desc: 'That\'s it. Our scanners search job boards, classifieds, permits, and property records. New leads appear in your dashboard instantly.', color: 'bg-purple-500' },
  { icon: Bell, title: '4. Get Alerts', desc: 'Every new lead sends you a real-time notification. Be the first contractor to respond and win the job.', color: 'bg-green-500' },
  { icon: Zap, title: '5. Automate Outreach', desc: 'One-click contact via email or SMS. Pre-built templates save you time. Track who you\'ve contacted and who replied.', color: 'bg-orange-500' },
];

const autoSources = [
  { icon: Globe, name: 'Job Boards', desc: 'Craigslist, Indeed Gigs, and more — scanned hourly' },
  { icon: Database, name: 'Permits & Records', desc: 'Building permits and property records — refreshed weekly' },
  { icon: MessageSquare, name: 'Classifieds & News', desc: 'Local newspapers and classified sites — checked daily' },
];

const bonusSources = [
  { icon: Facebook, name: 'Facebook Groups & Marketplace', desc: 'Better results when you connect an account (optional)' },
  { icon: Globe, name: 'Nextdoor / Neighbors', desc: 'Local community posts — works best with credentials' },
];

export default function OperationsGuide() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-0">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">How LeadForge Works</h1>
        <p className="text-sm sm:text-base text-gray-500 mt-2">
          Set up in 2 minutes. No credit card needed. Start receiving leads instantly from public sources.
        </p>
      </div>

      {/* Quick setup steps */}
      <div className="grid gap-4 sm:gap-6 mb-10">
        {steps.map(({ icon: Icon, title, desc, color }) => (
          <div key={title} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 flex items-start gap-4 hover:shadow-sm transition-shadow">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500 mt-1">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Source types */}
      <h2 className="text-xl font-bold text-gray-900 mb-4">Where Leads Come From</h2>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-green-600 mb-3 flex items-center gap-2">
          <Zap size={16} /> Running automatically — no setup needed
        </h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {autoSources.map(({ icon: Icon, name, desc }) => (
            <div key={name} className="bg-white rounded-xl border border-green-200 p-4">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center mb-2">
                <Icon size={16} className="text-green-600" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">{name}</h4>
              <p className="text-xs text-gray-500 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-10">
        <h3 className="text-sm font-semibold text-amber-600 mb-3 flex items-center gap-2">
          <Bell size={16} /> Bonus sources — better with an account
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {bonusSources.map(({ icon: Icon, name, desc }) => (
            <div key={name} className="bg-white rounded-xl border border-amber-200 p-4">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-2">
                <Icon size={16} className="text-amber-600" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">{name}</h4>
              <p className="text-xs text-gray-500 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Engine room */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-5 sm:p-6 mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Database size={18} className="text-indigo-500" /> The Engine Room
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          Behind the scenes, LeadForge continuously runs:
        </p>
        <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-600">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400" /> Lead scrapers every 15-30 min</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400" /> Dedup & enrichment pipeline</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400" /> Zip code + trade matching</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400" /> Real-time SSE push alerts</div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="text-center py-6">
        <p className="text-sm text-gray-500">
          Everything's set up and running. Just add your trades and zip codes in{' '}
          <a href="/dashboard/settings" className="text-indigo-600 font-medium hover:underline">Settings</a>.
        </p>
      </div>
    </div>
  );
}