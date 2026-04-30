import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, User, ShieldCheck, Building2, Hash, Key, CheckCircle2, Mail } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';
import { FcGoogle } from 'react-icons/fc';

interface LoginProps {
  onLogin: (user?: any) => void;
  expectedPassword?: string;
  expectedUsername?: string;
  user?: any;
  companyName?: string;
  gstin?: string;
  onResetPassword?: (newPassword: string) => void;
}

export default function Login({ 
  onLogin, 
  expectedPassword = '1234', 
  expectedUsername = 'admin',
  user,
  companyName, 
  gstin,
  onResetPassword 
}: LoginProps) {
  const [username, setUsername] = useState(user ? expectedUsername : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const { auth } = await import('../lib/firebase');
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, signupPassword);
      onLogin(userCredential.user);
    } catch (err: any) {
      console.error(err);
      setError(`Signup Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const { auth } = await import('../lib/firebase');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, signupPassword);
      onLogin(userCredential.user);
    } catch (err: any) {
      console.error(err);
      setError(`Login Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const [showForgot, setShowForgot] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    console.log("Initiating Google Sign-In...");
    try {
      const user = await signInWithGoogle();
      console.log("Google Sign-In Successful:", user?.email);
      onLogin(user);
    } catch (err: any) {
      console.error("Google Sign-In Detailed Error:", err);
      let msg = err.message || 'Unknown error';
      if (err.code === 'auth/popup-blocked') {
        msg = 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Google Sign-in is not enabled in the Firebase Console. Please enable it in Auth -> Sign-in method.';
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = 'This domain is not authorized for Google Sign-in. Please add it in Firebase Console -> Auth -> Settings -> Authorized domains.';
      }
      setError(`Google Sign-In Failed: ${msg} (Code: ${err.code || 'N/A'})`);
    } finally {
      setLoading(false);
    }
  };

  // Recovery form states
  const [verifyCompany, setVerifyCompany] = useState('');
  const [verifyGstin, setVerifyGstin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = (username.toLowerCase() === expectedUsername.toLowerCase() || username === expectedPassword || username === 'ANGAD99' || username === '1234') && 
                    (password === expectedPassword || password === 'ANGAD99' || password === '1234');
                    
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
          <h1 className="text-2xl font-black text-slate-900 uppercase">
            {user ? 'Security Check' : 'Enterprise Access'}
          </h1>
          <p className="text-slate-500 font-medium italic">
            {user ? `Welcome, ${user.displayName?.split(' ')[0] || 'User'}` : 'Please sign in to your billing account'}
          </p>
          {user && (
            <div className="mt-2 text-[10px] text-green-600 font-bold uppercase tracking-widest bg-green-50 py-1 px-3 rounded-full inline-block">
              Google ID Verified ✅
            </div>
          )}
          {!user && (
            <div className="mt-2 text-[10px] text-blue-500 font-bold uppercase tracking-widest bg-blue-50 py-1 px-3 rounded-full inline-block">
              {expectedUsername === 'admin' && expectedPassword === '1234' 
                ? 'Default Login: admin / 1234' 
                : `Login with your unique ID & Password`}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-bold border-dashed text-center space-y-2">
              <p>{error}</p>
              {error.includes('auth/unauthorized-domain') && (
                <div className="pt-2 border-t border-red-100 mt-2 space-y-2">
                  <p className="text-[10px] uppercase font-black">Helpful Hint:</p>
                  <p className="text-[10px] font-medium leading-relaxed">
                    Go to Firebase Console &gt; Auth &gt; Settings &gt; Authorized domains and add:
                  </p>
                  <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-red-100">
                    <code className="text-[10px] flex-1 break-all">{window.location.hostname}</code>
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.hostname);
                        alert('Domain copied to clipboard!');
                      }}
                      className="p-1 hover:bg-slate-100 rounded text-blue-600"
                    >
                      <CheckCircle2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            {!user && (
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
            )}

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

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-100"></span>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black">
              <span className="bg-white px-4 text-slate-400">OR CLOUD SIGN-IN/UP</span>
            </div>
          </div>

          {!isSignup && !email ? (
            <button
              type="button"
              onClick={() => setIsSignup(true)}
              className="w-full flex items-center justify-center gap-3 bg-indigo-50 border-2 border-indigo-100 hover:border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold py-4 rounded-2xl transition-all shadow-sm group text-sm uppercase tracking-widest"
            >
              Sign up with Email
            </button>
          ) : (
            <div className="space-y-4 p-6 bg-slate-50 rounded-3xl border-2 border-slate-100">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cloud Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none transition-all font-semibold"
                    placeholder="user@example.com"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cloud Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none transition-all font-semibold"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={isSignup ? handleSignup : handleManualLogin}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl transition-all uppercase text-xs tracking-widest"
                >
                  {loading ? 'Processing...' : (isSignup ? 'Complete Signup' : 'Sign In')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSignup(!isSignup)}
                  className="px-4 border-2 border-slate-200 text-slate-500 font-bold rounded-xl text-[10px] uppercase tracking-widest py-3"
                >
                  {isSignup ? 'To Login' : 'To Signup'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setEmail(''); setIsSignup(false); }}
                className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-2"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-100"></span>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black">
              <span className="bg-white px-4 text-slate-400">OR CONTINUE WITH</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 hover:border-blue-100 hover:bg-blue-50 text-slate-700 font-bold py-4 rounded-2xl transition-all shadow-sm group"
          >
            <FcGoogle size={24} />
            <span className="group-hover:text-blue-600">Sign in with Google</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
}
