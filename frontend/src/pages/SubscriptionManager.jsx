/**
 * SubscriptionManager — Tier pricing with zip code limits, mobile-responsive
 * Shows free trial banner at top, then paid plan cards below.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Star, MapPin, Crown, ArrowRight } from 'lucide-react';
import { subscriptionsAPI, trialAPI, usersAPI } from '../services/api';

const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 29,
    features: ['50 leads/month', '1 zip code area', 'Real-time alerts', 'Basic dashboard', 'Email support'],
  },
  {
    id: 'pro', name: 'Pro', price: 79,
    features: ['200 leads/month', 'Up to 5 zip codes', 'Automated email/SMS', 'Calendar booking', 'Follow-up automation', 'Multi-trade support'],
  },
  {
    id: 'elite', name: 'Elite', price: 199, popular: true,
    features: ['Unlimited leads', 'Unlimited zip codes', 'Review request engine', 'Referral program', 'Priority support', 'Dedicated account manager'],
  },
];

const TIER_ICONS = { starter: MapPin, pro: Zap, elite: Star };

export default function SubscriptionManager() {
  const [currentTier, setCurrentTier] = useState('starter');
  const [trialStatus, setTrialStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    subscriptionsAPI.current().then(({ data }) => setCurrentTier(data.tier || 'starter')).catch(() => {});
    trialAPI.status().then(({ data }) => setTrialStatus(data)).catch(() => {});
  }, []);

  const isTrialActive = trialStatus?.is_trial_active;
  const isTrialBlocked = trialStatus?.is_blocked;

  const handleUpgrade = async (tier) => {
    try {
      await usersAPI.upgrade(tier);
      alert(`Upgraded to ${tier} plan!`);
      setCurrentTier(tier);
      navigate('/dashboard/leads');
    } catch (err) {
      alert(err.response?.data?.detail || 'Upgrade failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-12 px-4">
      <div className="max-w-5xl mx-auto">

        {/* ── Free Trial Banner ─────────────────────────────────────── */}
        {isTrialActive && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 sm:p-8 mb-8 text-white shadow-xl">
            <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Crown size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1">Start with 1 free lead</h2>
                <p className="text-indigo-100 text-sm">
                  You've used {trialStatus.trial_leads_used} of {trialStatus.trial_limit} free lead{trialStatus.trial_limit > 1 ? 's' : ''}.
                  No credit card needed to try it out.
                </p>
              </div>
              <span className="text-xs font-medium bg-white/20 px-3 py-1.5 rounded-full whitespace-nowrap">
                {trialStatus.trial_leads_used}/{trialStatus.trial_limit} used
              </span>
            </div>
            <div className="mt-4 w-full bg-white/20 rounded-full h-2">
              <div className="bg-white rounded-full h-2 transition-all"
                   style={{ width: `${(trialStatus.trial_leads_used / trialStatus.trial_limit) * 100}%` }} />
            </div>
          </div>
        )}

        {isTrialBlocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8 mb-8 shadow-sm">
            <div className="flex items-center gap-4 flex-col sm:flex-row">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Crown size={24} className="text-amber-600" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-lg font-bold text-amber-900 mb-1">Free lead used up!</h2>
                <p className="text-amber-700 text-sm">
                  You've used your free lead. Pick a plan below to keep getting leads.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Plan Selection Header ─────────────────────────────────── */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {isTrialActive ? 'Upgrade to unlock unlimited leads' : 'Choose your plan'}
          </h1>
          <p className="text-sm sm:text-base text-gray-500 mt-2">Cover more zip codes as your business grows</p>
        </div>

        {/* ── Plan Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {PLANS.map((plan) => {
            const Icon = TIER_ICONS[plan.id] || MapPin;
            const isCurrent = currentTier === plan.id;

            return (
              <div key={plan.id}
                   className={`relative bg-white rounded-2xl border-2 p-5 sm:p-6 flex flex-col ${
                     plan.popular ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'
                   }`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
                    Most Popular
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Icon size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  </div>
                </div>

                <div className="mb-5">
                  <span className="text-4xl font-extrabold text-gray-900">${plan.price}</span>
                  <span className="text-gray-500 text-sm">/month</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent}
                  className={`w-full py-3 text-sm font-semibold rounded-xl transition-all active:scale-[0.98] ${
                    isCurrent
                      ? 'bg-gray-100 text-gray-400 cursor-default'
                      : plan.popular
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                        : 'bg-white text-indigo-600 border-2 border-indigo-600 hover:bg-indigo-50'
                  }`}>
                  {isCurrent ? 'Current Plan' : 'Upgrade'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Mobile note */}
        <p className="text-center text-xs text-gray-400 mt-8">
          Start with 1 free lead, no credit card needed. Upgrade anytime.
        </p>
      </div>
    </div>
  );
}