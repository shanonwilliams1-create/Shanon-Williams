/**
 * SubscriptionManager — View plans and manage subscription
 */
import React, { useState, useEffect } from 'react';
import { Check, Zap, Star } from 'lucide-react';
import { subscriptionsAPI } from '../services/api';

const tierIcons = { starter: Zap, pro: Zap, elite: Star };

export default function SubscriptionManager() {
  const [plans, setPlans] = useState([]);
  const [currentTier, setCurrentTier] = useState('starter');

  useEffect(() => {
    subscriptionsAPI.listPlans().then(({ data }) => setPlans(data)).catch(console.error);
    subscriptionsAPI.current().then(({ data }) => setCurrentTier(data.tier)).catch(() => {});
  }, []);

  const features = {
    starter: ['50 leads/month', 'Real-time alerts', 'Lead management dashboard', 'Email support'],
    pro: ['200 leads/month', 'Everything in Starter', 'Automated email/SMS outreach', 'Calendar booking', 'Follow-up automation', 'Multi-trade support'],
    elite: ['Unlimited leads', 'Everything in Pro', 'Review request engine', 'Referral program', 'Priority support', 'Dedicated account manager'],
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">Choose your plan</h1>
          <p className="text-gray-500 mt-2">Start with a free trial, upgrade anytime</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {['starter', 'pro', 'elite'].map((tier) => {
            const price = tier === 'starter' ? 29 : tier === 'pro' ? 79 : 199;
            const isCurrent = currentTier === tier;
            const Icon = tierIcons[tier] || Zap;
            return (
              <div key={tier} className={`bg-white rounded-2xl border-2 p-6 ${isCurrent ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'} ${tier === 'elite' ? 'relative' : ''}`}>
                {tier === 'elite' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-full">Popular</div>}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center"><Icon size={20} className="text-indigo-600" /></div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">{tier}</h3>
                    {plans.find(p => p.name === tier) && <p className="text-xs text-gray-500">{plans.find(p => p.name === tier).description}</p>}
                  </div>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">${price}</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {features[tier].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={isCurrent}
                  className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isCurrent ? 'bg-gray-100 text-gray-400 cursor-default' :
                    tier === 'elite' ? 'bg-indigo-600 text-white hover:bg-indigo-700' :
                    'bg-white text-indigo-600 border border-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : 'Upgrade'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}