/**
 * SettingsPanel — Profile, trades, zip codes, subscription
 */
import React, { useState, useEffect } from 'react';
import { Save, User, CreditCard, MapPin, Plus, X, Wrench } from 'lucide-react';
import { usersAPI } from '../../services/api';

const TIER_ZIP_LIMITS = { starter: 1, pro: 5, elite: 999 };
const ALL_TRADES = [
  'electrician', 'plumber', 'carpenter', 'roofer',
  'landscaper', 'painter', 'general', 'hvac',
  'demolition', 'cabinets', 'countertops', 'other',
];

export default function SettingsPanel() {
  const [user, setUser] = useState({ full_name: '', email: '', trade: '', subscription_tier: 'starter', location: '' });
  const [zipCodes, setZipCodes] = useState([]);
  const [trades, setTrades] = useState([]);
  const [newZip, setNewZip] = useState('');
  const [savingZip, setSavingZip] = useState(false);
  const [savingTrades, setSavingTrades] = useState(false);
  const [saved, setSaved] = useState('');
  const [zipError, setZipError] = useState('');

  useEffect(() => {
    usersAPI.getMe().then(({ data }) => {
      setUser(data);
      setZipCodes(data.service_zip_codes || []);
      setTrades(data.target_trades || []);
    }).catch(console.error);
  }, []);

  const zipLimit = TIER_ZIP_LIMITS[user.subscription_tier] || 1;

  // ── Zip codes ─────────────────────────────────────────────────
  const addZip = () => {
    const z = newZip.trim();
    if (!z) return;
    if (!/^\d{5}$/.test(z)) { setZipError('Enter a valid 5-digit zip'); return; }
    if (zipCodes.includes(z)) { setZipError('Already added'); return; }
    if (zipCodes.length >= zipLimit) {
      setZipError(`Plan allows ${zipLimit} zip${zipLimit > 1 ? 's' : ''}. Upgrade to add more.`);
      return;
    }
    setZipCodes([...zipCodes, z]);
    setNewZip('');
    setZipError('');
  };
  const saveZipCodes = async () => {
    setSavingZip(true);
    try { await usersAPI.updateZipCodes(zipCodes); setSaved('zip'); setTimeout(() => setSaved(''), 2000); }
    catch (err) { alert(err.response?.data?.detail || 'Failed'); }
    finally { setSavingZip(false); }
  };

  // ── Trades ────────────────────────────────────────────────────
  const toggleTrade = (t) => {
    setTrades((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };
  const saveTrades = async () => {
    setSavingTrades(true);
    try { await usersAPI.updateTrades(trades); setSaved('trades'); setTimeout(() => setSaved(''), 2000); }
    catch (err) { alert(err.response?.data?.detail || 'Failed'); }
    finally { setSavingTrades(false); }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">Set your trades and service areas to start receiving leads</p>

      <div className="bg-white rounded-xl border border-gray-200 divide-y">
        {/* Profile */}
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <User size={20} className="text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input value={user.full_name} onChange={(e) => setUser({ ...user, full_name: e.target.value })}
                     className="w-full px-4 py-2.5 text-sm border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input value={user.email} disabled
                     className="w-full px-4 py-2.5 text-sm border rounded-lg bg-gray-50 text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input value={user.location} onChange={(e) => setUser({ ...user, location: e.target.value })}
                     placeholder="e.g. Seattle, WA"
                     className="w-full px-4 py-2.5 text-sm border rounded-lg" />
            </div>
          </div>
        </div>

        {/* Trades */}
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <Wrench size={20} className="text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">My Trades</h2>
          </div>
          <p className="text-sm text-gray-500 mb-3">Select the types of work you want to be contacted about.</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => setTrades(trades.length === ALL_TRADES.length ? [] : [...ALL_TRADES])}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all active:scale-95 ${
                      trades.length === ALL_TRADES.length
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-500 border-dashed border-gray-300 hover:border-emerald-400 hover:text-emerald-600'
                    }`}>
              All of the Above
            </button>
            {ALL_TRADES.map((t) => (
              <button key={t} onClick={() => toggleTrade(t)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all active:scale-95 ${
                        trades.includes(t)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                      }`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mb-3">{trades.length} trade{trades.length !== 1 ? 's' : ''} selected</p>
          <button onClick={saveTrades} disabled={savingTrades}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            <Save size={16} /> {savingTrades ? 'Saving...' : saved === 'trades' ? 'Saved!' : 'Save Trades'}
          </button>
        </div>

        {/* Service Areas */}
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <MapPin size={20} className="text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">Service Areas</h2>
            <span className="ml-auto text-xs text-gray-400">{zipCodes.length}/{zipLimit} used</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Zip codes where you work.
            <span className="font-medium capitalize"> {user.subscription_tier} plan: {zipLimit === 999 ? 'unlimited' : zipLimit} max.</span>
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {zipCodes.length === 0 && <span className="text-sm text-gray-400 italic">No zip codes added</span>}
            {zipCodes.map((z) => (
              <span key={z} className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                {z}
                <button onClick={() => setZipCodes(zipCodes.filter((x) => x !== z))} className="hover:text-red-500"><X size={14} /></button>
              </span>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={newZip} onChange={(e) => setNewZip(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && addZip()}
                   placeholder="Enter zip (e.g. 98101)" maxLength={5}
                   className="flex-1 px-4 py-2.5 text-sm border rounded-lg" />
            <button onClick={addZip} disabled={zipCodes.length >= zipLimit}
                    className="flex items-center justify-center gap-1 px-4 py-2.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 border border-indigo-200">
              <Plus size={16} /> Add
            </button>
          </div>
          {zipError && <p className="text-xs text-red-500 mt-1">{zipError}</p>}
          <button onClick={saveZipCodes} disabled={savingZip}
                  className="mt-4 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            <Save size={16} /> {savingZip ? 'Saving...' : saved === 'zip' ? 'Saved!' : 'Save Zip Codes'}
          </button>
        </div>

        {/* Subscription */}
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard size={20} className="text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current Plan</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">{user.subscription_tier || 'Starter'}</p>
            </div>
            <a href="/subscription" className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100">Manage Plan</a>
          </div>
        </div>
      </div>
    </div>
  );
}