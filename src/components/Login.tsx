import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, User, ShieldCheck, Building2, Hash, Key, CheckCircle2, Mail, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { auth, db, signInWithGoogle, signInWithGoogleRedirect } from '../lib/firebase';
import { FcGoogle } from 'react-icons/fc';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface LoginProps {
  onLogin: (user?: any, customId?: string) => void;
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
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
        msg = 'Sign-in popup was blocked by your browser (auth/popup-blocked). Please allow popups or try the Redirect login below.';
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

  const handleGoogleRedirectLogin = async () => {
    setLoading(true);
    setError('');
    console.log("Initiating Google Redirect Sign-In...");
    try {
      await signInWithGoogleRedirect();
    } catch (err: any) {
      console.error("Google Redirect Detailed Error:", err);
      setError(`Google Redirect Sign-In Failed: ${err.message || 'Unknown error'} (Code: ${err.code || 'N/A'})`);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Check Global Cloud Credentials first
      const credPath = `custom_credentials/${username}`;
      const credRef = doc(db, 'custom_credentials', username);
      let credSnap;
      try {
        credSnap = await getDoc(credRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, credPath);
      }

      if (credSnap && credSnap.exists()) {
        const data = credSnap.data();
        if (data.username === username && data.password === password) {
          onLogin(null, username);
          return;
        } else if (data.password !== password) {
          setError('Invalid Password for this User ID!');
          setLoading(false);
          return;
        }
      }

      // 2. Fallback to Local/Default check or Setup new Cloud ID?
      const isLocalUsernameValid = (username.toLowerCase() === expectedUsername.toLowerCase() || username === expectedPassword || username === 'ANGAD99' || username === '1234');
      const isLocalPasswordValid = (password === expectedPassword || password === 'ANGAD99' || password === '1234');
      
      if (isLocalUsernameValid && isLocalPasswordValid) {
        // If it's valid locally, we register it to the Cloud for future cross-device sync
        try {
          await setDoc(credRef, {
            username: username,
            password: password,
            createdAt: new Date().toISOString()
          });
        } catch (err) {
           handleFirestoreError(err, OperationType.CREATE, credPath);
        }
        onLogin(null, username);
      } else {
        setError('Invalid User ID or Password! Are you using the correct name?');
      }
    } catch (err: any) {
      console.error("Login Error Details:", err);
      try {
        const parsedError = JSON.parse(err.message);
        setError(`Security Block: ${parsedError.error}. Check your credentials.`);
      } catch {
        setError(`Auth Error: ${err.message || 'Server connection failed'}`);
      }
    } finally {
      setLoading(false);
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
    <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute top-4 right-4 text-blue-600 text-xl font-black tracking-tighter hidden md:block">
        PRO BILLER I
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm space-y-4 py-4"
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-100 mb-3">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-xl font-black text-slate-900 uppercase leading-none">
            {user ? 'Security Check' : 'Enterprise Access'}
          </h1>
          <p className="text-slate-500 text-xs font-medium italic mt-1">
            {user ? `Welcome, ${user.displayName?.split(' ')[0] || 'User'}` : 'Please sign in to your billing account'}
          </p>
          {user && (
            <div className="mt-1 text-[9px] text-green-600 font-bold uppercase tracking-widest bg-green-50 py-0.5 px-3 rounded-full inline-block">
              Google ID Verified ✅
            </div>
          )}
          {!user && (
            <div className="mt-1 text-[9px] text-blue-500 font-bold uppercase tracking-widest bg-blue-50 py-0.5 px-3 rounded-full inline-block">
              {expectedUsername === 'admin' && expectedPassword === '1234' 
                ? 'Default Login: admin / 1234' 
                : `Login with your unique ID & Password`}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-[10px] font-bold border-dashed text-center space-y-1">
              <p>{error}</p>
              {error.includes('popup-blocked') && (
                <div className="pt-2 border-t border-red-100 mt-2 space-y-2">
                  <p className="text-[9px] uppercase font-black text-red-700">Sandbox/Iframe Bypass options:</p>
                  <p className="text-[9px] font-medium leading-relaxed text-red-500">
                    If popups are disabled or blocked in your browser, try Redirect Login below, or open this application in a <strong>New Tab</strong> using the top-right button in the Preview Frame.
                  </p>
                  <button
                    type="button"
                    onClick={handleGoogleRedirectLogin}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 rounded-xl text-[9px] uppercase tracking-widest transition-all mt-1 shadow-lg shadow-blue-100 flex items-center justify-center gap-1.5"
                  >
                    <FcGoogle size={14} className="bg-white rounded-full p-0.5" /> Sign-In via Redirect Method
                  </button>
                </div>
              )}
              {error.includes('auth/unauthorized-domain') && (
                <div className="pt-1 border-t border-red-100 mt-1 space-y-1">
                  <p className="text-[9px] uppercase font-black">Helpful Hint:</p>
                  <p className="text-[9px] font-medium leading-relaxed">
                    Go to Firebase Console &gt; Auth &gt; Settings &gt; Authorized domains and add:
                  </p>
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-red-100">
                    <code className="text-[9px] flex-1 break-all">{window.location.hostname}</code>
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.hostname);
                        alert('Domain copied to clipboard!');
                      }}
                      className="p-1 hover:bg-slate-100 rounded text-blue-600"
                    >
                      <CheckCircle2 size={10} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {!user && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">User Name / ID</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-semibold text-sm"
                    placeholder="Enter User Name"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Security Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-semibold text-sm"
                  placeholder="••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button 
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1E293B] hover:bg-[#334155] text-white font-black py-3 rounded-2xl text-base shadow-xl shadow-slate-200 transition-all active:scale-[0.98] uppercase disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Login'}
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-100"></span>
            </div>
            <div className="relative flex justify-center text-[9px] uppercase tracking-widest font-black">
              <span className="bg-white px-3 text-slate-400 text-center">CLOUD LOGIN (MULTI-DEVICE SYNC)</span>
            </div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-100 p-3 rounded-2xl">
            <p className="text-[9px] font-bold text-blue-700 uppercase tracking-widest mb-1.5 flex items-center gap-2">
              <RefreshCw size={10} className="animate-spin" /> Multi-Device / मल्टी-डिवाइस
            </p>
            <p className="text-[9px] text-blue-600 leading-tight font-medium">
              अपनी पुरानी ID और पासवर्ड को दूसरे डिवाइस पर चलाने के लिए पहले <b>Google</b> या <b>Email Login</b> करें।
            </p>
            <p className="text-[9px] text-blue-500 leading-tight mt-1">
              To access your data on other devices, you MUST use Google or Email login first.
            </p>
          </div>

          {!isSignup && !email ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsSignup(true)}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-indigo-100 hover:bg-indigo-700 text-[10px] uppercase tracking-widest"
              >
                <Mail size={14} /> Cloud Sign Up
              </button>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-white border-2 border-slate-100 hover:border-blue-100 hover:bg-blue-50 text-slate-700 font-bold py-3 rounded-2xl transition-all shadow-sm group text-[10px] uppercase tracking-widest"
              >
                <FcGoogle size={18} /> Google
              </button>
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Cloud Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none transition-all font-semibold text-sm"
                    placeholder="user@example.com"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Cloud Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-2.5 bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none transition-all font-semibold text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={isSignup ? handleSignup : handleManualLogin}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 rounded-xl transition-all uppercase text-[10px] tracking-widest"
                >
                  {loading ? 'Processing...' : (isSignup ? 'Complete Signup' : 'Sign In')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSignup(!isSignup)}
                  className="px-3 border-2 border-slate-200 text-slate-500 font-bold rounded-xl text-[9px] uppercase tracking-widest py-2.5"
                >
                  {isSignup ? 'To Login' : 'To Signup'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setEmail(''); setIsSignup(false); }}
                className="w-full text-[9px] font-bold text-slate-400 uppercase tracking-widest pt-1"
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
}
