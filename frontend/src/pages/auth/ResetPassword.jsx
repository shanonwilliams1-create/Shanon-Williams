/**
 * ResetPassword — Direct password reset (no email required)
 * Matches the dark theme of LoginForm/SignUpForm.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authAPI } from '../../services/api';

export default function ResetPassword() {
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(form.email, form.password);
      setSuccess(true);
      setTimeout(() => navigate('/auth/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/auth/login" className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <KeyRound size={16} /> Back to login
        </Link>

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center font-bold text-white text-lg mx-auto mb-4">LF</div>
          <h1 className="text-2xl font-bold text-white">Reset password</h1>
          <p className="text-gray-400 mt-1">Enter your email and new password</p>
        </div>

        {success ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
            <CheckCircle size={40} className="mx-auto mb-3 text-green-400" />
            <p className="text-green-300 font-medium text-lg">Password reset successful!</p>
            <p className="text-green-400/80 text-sm mt-1">Redirecting to login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 space-y-4">
            {error && <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">{error}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                     required placeholder="your@email.com"
                     className="w-full px-4 py-2.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={form.password}
                       onChange={(e) => setForm({ ...form, password: e.target.value })}
                       required minLength={8} placeholder="Min 8 characters"
                       className="w-full px-4 py-2.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 pr-10" />
                <button type="button" onClick={() => setShow(!show)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
              <input type={show ? 'text' : 'password'} value={form.confirm}
                     onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                     required placeholder="Repeat password"
                     className="w-full px-4 py-2.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500" />
            </div>

            <button type="submit" disabled={loading}
                    className="w-full py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <KeyRound size={16} />
              )}
              Reset Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}