import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Scale, Shield } from 'lucide-react';

export default function AttorneyVerify() {
  const nav      = useNavigate();
  const { state } = useLocation();
  const { tempToken, via, phone } = state || {};

  const [digits, setDigits]         = useState(['', '', '', '', '', '']);
  const [remember, setRemember]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const refs = Array.from({ length: 6 }, () => useRef(null));

  const handleDigit = (i, val) => {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) refs[i + 1].current?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs[i - 1].current?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      refs[5].current?.focus();
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < 6) { setError('Enter all 6 digits'); return; }
    setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/attorney/verify-2fa', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code, rememberDevice: remember }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Verification failed'); return; }
      nav('/attorney/dashboard');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
            <Scale size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">IntakeAI</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
            <Shield size={24} className="text-violet-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Two-step verification</h1>
          <p className="text-sm text-gray-500 mb-6">
            We sent a 6-digit code to your {via === 'sms' ? `phone ending in ${phone || '????'}` : 'email'}. Enter it below.
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input key={i} ref={refs[i]} type="text" inputMode="numeric" maxLength={1}
                  value={d}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => handleKey(i, e)}
                  className="w-11 h-13 text-center text-xl font-bold border-2 border-gray-200 rounded-lg
                             focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-colors"
                  style={{ height: '52px' }}
                />
              ))}
            </div>

            <label className="flex items-center justify-center gap-2 mb-6 cursor-pointer">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 accent-violet-600" />
              <span className="text-sm text-gray-600">Remember this browser for 30 days</span>
            </label>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50">
              {loading ? 'Verifying…' : 'Verify & Sign in'}
            </button>
          </form>

          <button onClick={() => nav('/attorney/login')}
            className="mt-4 text-sm text-gray-400 hover:text-gray-600">
            ← Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
