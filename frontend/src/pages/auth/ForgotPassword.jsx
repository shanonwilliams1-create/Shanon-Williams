/**
 * ForgotPassword — Password reset request
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { authAPI } from '../../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch (err) {
      alert('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/auth/login" className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft size={16} /> Back to login
        </Link>
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center font-bold text-white text-lg mx-auto mb-4">LF</div>
          <h1 className="text-2xl font-bold text-white">Reset password</h1>
          <p className="text-gray-400 mt-1">We'll send you a reset link</p>
        </div>
        {sent ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
            <Mail size={32} className="mx-auto mb-3 text-green-400" />
            <p className="text-green-300 font-medium">Check your email</p>
            <p className="text-green-400/80 text-sm mt-1">A reset link has been sent to {email}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-2.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Mail size={16} /> {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}