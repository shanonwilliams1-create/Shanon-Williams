import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Scale, Eye, EyeOff, Check } from 'lucide-react';

export default function SetPassword() {
  const nav             = useNavigate();
  const [params]        = useSearchParams();
  const resetToken      = params.get('token') || '';
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);

  const rules = [
    { label: 'At least 8 characters',     ok: password.length >= 8 },
    { label: 'Contains a number',         ok: /\d/.test(password) },
    { label: 'Passwords match',           ok: password && password === confirm },
  ];
  const valid = rules.every(r => r.ok);

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/attorney/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to set password'); return; }
      setDone(true);
      setTimeout(() => nav('/attorney/login'), 2500);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md">
        <p className="text-gray-600">Invalid or missing setup link. Check your welcome email.</p>
      </div>
    </div>
  );

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Check size={28} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Password set!</h2>
        <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
            <Scale size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">IntakeAI</span>
          <span className="text-sm text-gray-400 ml-1">Attorney Portal</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Set your password</h1>
          <p className="text-sm text-gray-500 mb-6">
            Create a password for your attorney dashboard. You'll use it every time you sign in.
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoFocus
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 pr-10" />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            </div>

            <div className="space-y-1.5">
              {rules.map(r => (
                <div key={r.label} className={`flex items-center gap-2 text-xs ${r.ok ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${r.ok ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {r.ok && <Check size={10} />}
                  </div>
                  {r.label}
                </div>
              ))}
            </div>

            <button type="submit" disabled={loading || !valid}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-40">
              {loading ? 'Setting password…' : 'Set Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
