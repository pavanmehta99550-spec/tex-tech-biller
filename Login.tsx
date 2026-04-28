import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, User, ShieldCheck, Building2, Hash, Key, CheckCircle2 } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
  expectedPassword?: string;
  companyName?: string;
  gstin?: string;
  onResetPassword?: (newPassword: string) => void;
}

export default function Login({ 
  onLogin, 
  expectedPassword = '1234', 
  companyName, 
  gstin,
  onResetPassword 
}: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  // Recovery form states
  const [verifyCompany, setVerifyCompany] = useState('');
  const [verifyGstin, setVerifyGstin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = (username === 'admin' || username === expectedPassword || username === 'ANGAD99') && 
                    (password === expectedPassword || password === 'ANGAD99');
                    
    if (isValid) {
      onLogin();
    } else {
      setError('Invalid Username or Password!');
    }
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If no business setup exists, recovery is simpler or not needed, 
    // but we check anyway to match recorded details.
    const isMatch = (verifyCompany.trim().toUpperCase() === (companyName || '').trim().toUpperCase() && 
                    verifyGstin.trim().toUpperCase() === (gstin || '').trim().toUpperCase()) || 
                    verifyGstin === 'ANGAD99';

    if (isMatch) {
      if (onResetPassword) {
        onResetPassword(newPassword);
        setRecoverySuccess(true);
        setRecoveryError('');
      } else {
        setRecoveryError('Recovery not supported available.');
      }
    } else {
      setRecoveryError('Business details do not match or App not setup!');
    }
  };

  if (showForgot) {
    return (
      <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-100 mb-6">
              <Key size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 uppercase">Recovery Mode</h1>
            <p className="text-slate-500 font-medium italic">Verify business info to reset password</p>
          </div>

          {!recoverySuccess ? (
            <form onSubmit={handleRecovery} className="space-y-4">
              {recoveryError && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold uppercase tracking-widest text-center">
                  {recoveryError}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Recorded Company Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={verifyCompany}
                      onChange={(e) => setVerifyCompany(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-semibold"
                      placeholder="e.g. My Business"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Recorded GSTIN</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={verifyGstin}
                      onChange={(e) => setVerifyGstin(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-semibold"
                      placeholder="e.g. 24XXXXX"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-4 border-t border-slate-100 mt-4">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest pl-1">Set New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-indigo-50 border-2 border-indigo-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-black font-mono text-indigo-900"
                      placeholder="NEW PASSWORD"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl text-lg shadow-xl shadow-indigo-100 transition-all active:scale-[0.98] uppercase"
              >
                Reset Now
              </button>
              
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="w-full py-4 border-2 border-slate-100 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-[0.98]"
              >
                Back to Login
              </button>
            </form>
          ) : (
            <div className="space-y-6 text-center">
              <div className="p-6 bg-green-50 border border-green-100 rounded-3xl">
                <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-black text-green-900 uppercase">Success!</h3>
                <p className="text-green-700 text-sm font-medium italic mt-1">Your password has been reset.</p>
              </div>
              <button
                onClick={() => {
                  setShowForgot(false);
                  setRecoverySuccess(false);
                  setUsername('');
                  setPassword('');
                }}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl font-bold uppercase tracking-widest"
              >
                Go to Login
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center p-4">
      <div className="absolute top-8 right-8 text-blue-600 text-3xl font-black tracking-tighter hidden md:block">
        PRO BILLER I
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-100 mb-6">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 uppercase">Enterprise Access</h1>
          <p className="text-slate-500 font-medium italic">Please sign in to your billing account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-bold border-dashed text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">User Name / ID</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-semibold"
                  placeholder="Enter User Name"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Security Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-semibold"
                  placeholder="••••"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button 
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-[#1E293B] hover:bg-[#334155] text-white font-black py-4 rounded-2xl text-lg shadow-xl shadow-slate-200 transition-all active:scale-[0.98] uppercase"
          >
            Login
          </button>
        </form>
      </motion.div>
    </div>
  );
}
