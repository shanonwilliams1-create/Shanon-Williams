/**
 * ReferralProgram — Refer friends and track rewards
 */
import React, { useState, useEffect } from 'react';
import { Share2, Users, Award, Send } from 'lucide-react';
import { referralsAPI } from '../../services/api';

export default function ReferralProgram() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ referred_email: '', referred_name: '' });

  const fetch = () => referralsAPI.list().then(({ data }) => setReferrals(data)).catch(console.error).finally(() => setLoading(false));
  useEffect(() => { fetch(); }, []);

  const sendInvite = async () => {
    if (!form.referred_email) return;
    try {
      await referralsAPI.create(form);
      setForm({ referred_email: '', referred_name: '' });
      fetch();
    } catch (err) { alert('Failed to send referral'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
          <p className="text-sm text-gray-500 mt-1">Refer other contractors and earn rewards</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Invite a Contractor</h2>
        <div className="flex flex-wrap gap-3">
          <input value={form.referred_name} onChange={(e) => setForm({ ...form, referred_name: e.target.value })} placeholder="Name" className="flex-1 min-w-[150px] px-4 py-2.5 text-sm border rounded-lg" />
          <input value={form.referred_email} onChange={(e) => setForm({ ...form, referred_email: e.target.value })} placeholder="Email" className="flex-1 min-w-[200px] px-4 py-2.5 text-sm border rounded-lg" />
          <button onClick={sendInvite} disabled={!form.referred_email} className="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            <Send size={16} /> Send Invite
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" /></div>
      ) : referrals.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Share2 size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No referrals yet</p>
          <p className="text-sm">Refer a fellow contractor to earn rewards.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {referrals.map((ref) => (
            <div key={ref.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{ref.referred_name || ref.referred_email}</p>
                  <p className="text-sm text-gray-500">{ref.referred_email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{ref.status}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Reward: {ref.reward_status}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}