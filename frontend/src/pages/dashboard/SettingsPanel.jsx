/**
 * SettingsPanel — User profile and account settings
 */
import React, { useState, useEffect } from 'react';
import { Save, User, Shield, Bell, CreditCard } from 'lucide-react';
import { usersAPI } from '../../services/api';

export default function SettingsPanel() {
  const [user, setUser] = useState({ full_name: '', email: '', trade: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    usersAPI.getMe().then(({ data }) => setUser(data)).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await usersAPI.updateMe(user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { alert('Failed to save settings'); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">Manage your account and preferences</p>

      <div className="bg-white rounded-xl border border-gray-200 divide-y">
        {/* Profile */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <User size={20} className="text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input value={user.full_name} onChange={(e) => setUser({ ...user, full_name: e.target.value })} className="w-full px-4 py-2.5 text-sm border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input value={user.email} disabled className="w-full px-4 py-2.5 text-sm border rounded-lg bg-gray-50 text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trade</label>
              <select value={user.trade} onChange={(e) => setUser({ ...user, trade: e.target.value })} className="w-full px-4 py-2.5 text-sm border rounded-lg">
                <option value="">Select trade</option>
                <option value="electrician">Electrician</option>
                <option value="plumber">Plumber</option>
                <option value="carpenter">Carpenter</option>
                <option value="roofer">Roofer</option>
                <option value="landscaper">Landscaper</option>
                <option value="painter">Painter</option>
                <option value="general">General Contractor</option>
              </select>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard size={20} className="text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current Plan</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">{user.subscription_tier || 'Starter'}</p>
            </div>
            <a href="/subscription" className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100">
              Manage Plan
            </a>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="mt-6 flex justify-end">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          <Save size={16} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}