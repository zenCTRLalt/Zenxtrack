/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, loginWithGoogle, loginAnonymously, logoutUser, db, handleFirestoreError, OperationType } from './lib/firebase';
import { TrackingLink } from './types';
import VisitorTracker from './components/VisitorTracker';
import LinkGenerator from './components/LinkGenerator';
import LinkDetails from './components/LinkDetails';
import KPICard from './components/KPICard';
import { 
  MapPin, LogIn, LogOut, ChevronRight, Link2, Plus, 
  BarChart3, ShieldCheck, Activity, Globe2, Compass, AlertCircle, Sparkles, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [selectedLink, setSelectedLink] = useState<TrackingLink | null>(null);
  const [linkIdFromUrl, setLinkIdFromUrl] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // 1. Intercept tracking URL parameter ?t=ID or #/t/ID on initial render
  useEffect(() => {
    // Check search params first: ?t=ID
    const searchParams = new URLSearchParams(window.location.search);
    const tParam = searchParams.get('t');
    if (tParam) {
      setLinkIdFromUrl(tParam);
      return;
    }

    // Fallback: Check hash or paths just in case (e.g. #/t/ID)
    const hash = window.location.hash;
    const match = hash.match(/#\/t\/([a-zA-Z0-9_\-]+)/);
    if (match && match[1]) {
      setLinkIdFromUrl(match[1]);
    }
  }, []);

  // 2. Auth State Change Listener
  useEffect(() => {
    const savedGuest = localStorage.getItem('telemetry_guest_user');
    if (savedGuest) {
      try {
        setUser(JSON.parse(savedGuest));
        setAuthLoading(false);
      } catch (e) {
        localStorage.removeItem('telemetry_guest_user');
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        localStorage.removeItem('telemetry_guest_user');
        setUser({
          uid: u.uid,
          displayName: u.displayName,
          email: u.email,
          photoURL: u.photoURL,
        });
      } else {
        const guest = localStorage.getItem('telemetry_guest_user');
        if (guest) {
          try {
            setUser(JSON.parse(guest));
          } catch (e) {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. Realtime Tracking Links Listener (Loads links created by the current user)
  useEffect(() => {
    if (!user) {
      setLinks([]);
      return;
    }

    setLinksLoading(true);
    const linksCollectionRef = collection(db, 'links');
    const q = query(
      linksCollectionRef, 
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const linksArr: TrackingLink[] = [];
      snapshot.forEach((doc) => {
        const val = doc.data();
        linksArr.push({
          id: doc.id,
          title: val.title,
          destinationUrl: val.destinationUrl,
          creatorId: val.creatorId,
          createdAt: val.createdAt?.toDate() || new Date(),
          clicksCount: val.clicksCount || 0
        });
      });
      setLinks(linksArr);
      setLinksLoading(false);

      // Keep selectedLink state up to date if currently viewed
      if (selectedLink) {
        const updated = linksArr.find(l => l.id === selectedLink.id);
        if (updated) {
          setSelectedLink(updated);
        }
      }
    }, (error) => {
      setLinksLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'links');
    });

    return () => unsubscribe();
  }, [user]);

  // Handle Login Flow
  const handleLogin = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    setLoginError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Login component failure: ", err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('cancelled-popup-request') || errMsg.includes('popup-closed-by-user') || errMsg.includes('assertion') || errMsg.includes('popup')) {
        setLoginError("Popups are blocked or cancelled in this preview iframe. Please try \"Sign In as Guest\" below to test the app!");
      } else {
        setLoginError("Sign-in failed. Please use \"Sign In as Guest\" below to bypass pop-ups!");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Graceful Fallback for Sandybox Preview Iframe environments
  const handleGuestLogin = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    setLoginError(null);
    try {
      const randId = Math.random().toString(36).substring(2, 10);
      const guestObj: AppUser = {
        uid: `guest_${randId}`,
        displayName: 'Guest Operator',
        email: 'guest@telemetry.io',
        photoURL: `https://api.dicebear.com/7.x/identicon/svg?seed=guest_${randId}`
      };
      localStorage.setItem('telemetry_guest_user', JSON.stringify(guestObj));
      setUser(guestObj);
    } catch (err: any) {
      console.error("Guest login component failure: ", err);
      setLoginError("Failed to initiate Guest session. Please retry!");
    } finally {
      setLoginLoading(false);
    }
  };

  // Sign Out helper
  const handleLogout = async () => {
    localStorage.removeItem('telemetry_guest_user');
    setUser(null);
    try {
      await logoutUser();
    } catch (e) {
      console.error("Logout error: ", e);
    }
  };

  // Helper calculation totals
  const totalClicks = links.reduce((sum, link) => sum + link.clicksCount, 0);
  const activeLinksCount = links.length;

  // Intercept and load visitor tracker if matching ID
  if (linkIdFromUrl) {
    return <VisitorTracker linkId={linkIdFromUrl} />;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 text-gray-900 font-sans select-none antialiased">
      {authLoading ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <span className="w-10 h-10 border-4 border-indigo-150 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-xs font-mono text-gray-400 mt-2 uppercase tracking-widest">Checking Authentication Session...</p>
          </div>
        </div>
      ) : !user ? (
        /* Login Page View */
        <div className="min-h-screen flex flex-col md:flex-row items-center justify-center p-4 gap-12 max-w-6xl mx-auto">
          {/* Visual Presentation side */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex-1 space-y-6 max-w-md hidden md:block"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-700 uppercase tracking-wide">
              <Compass className="w-4 h-4 animate-spin-pulse" />
              <span>Location Tracker Engine</span>
            </div>

            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight leading-none">
              Capture Real-time <br />
              <span className="text-indigo-600">Visitor Telemetry</span> securely.
            </h1>
            
            <p className="text-sm text-gray-500 leading-relaxed">
              Create campaigns and map geographical footprints instantly. Support precise GPS coordinates approvals and high-accuracy network fallbacks.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900">Zero-Trust Privacy Guards</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Dual analytical routing (GPS handshake + automated fallback IP resolution).</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900">Instant Real-Time Stream</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Watch entries stream directly on your operational dashboard in real-time.</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Secure Credential Authorization card */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-md bg-white p-8 rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 text-center space-y-6 shrink-0"
          >
            <div className="flex justify-center">
              <div className="w-14 h-14 bg-indigo-650 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-650/15">
                <MapPin className="w-7 h-7" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-gray-950 tracking-tight">Access Location Console</h2>
              <p className="text-xs text-gray-400 px-4 leading-normal">Authenticate using a verified credential to create campaigns and review live access logs.</p>
            </div>

            {/* Error display */}
            <AnimatePresence>
              {loginError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2.5 text-left text-amber-850 text-xs overflow-hidden"
                >
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-tight">{loginError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-3 font-semibold">
              <button
                type="button"
                onClick={handleLogin}
                disabled={loginLoading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                {loginLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>{loginLoading ? 'Please wait...' : 'Continue with Google Secure Login'}</span>
              </button>

              <div className="flex items-center gap-2 text-gray-300 my-4 select-none">
                <span className="h-[1px] bg-gray-150 flex-1" />
                <span className="text-[10px] text-gray-400 font-bold tracking-wider">Iframe Friendly Fallback</span>
                <span className="h-[1px] bg-gray-150 flex-1" />
              </div>

              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={loginLoading}
                className="w-full py-3 bg-emerald-50 hover:bg-emerald-100/80 disabled:opacity-60 text-emerald-800 font-bold rounded-xl text-xs transition-all border border-emerald-100 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                {loginLoading ? (
                  <span className="w-4 h-4 border-2 border-emerald-800/30 border-t-emerald-800 rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>Sign In as Guest (Instantly bypass popups!)</span>
              </button>
            </div>

            <p className="text-[10px] text-gray-400">
              Consent required: Location queries require active tracking consent on visitors.
            </p>
          </motion.div>
        </div>
      ) : (
        /* Authorized Creator View layout */
        <div className="min-h-screen flex flex-col">
          {/* Top Navbar */}
          <header className="sticky top-0 bg-white border-b border-gray-150 z-30 select-none">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              {/* Brand identifier */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow shadow-indigo-650/10">
                  <MapPin className="w-4 h-4 shrink-0" />
                </div>
                <div>
                  <span className="text-sm font-extrabold text-gray-950 block">Telemetry Platform</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest leading-none mt-0.5">Control Center</span>
                </div>
              </div>

              {/* Creator details and Sign out action */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 p-1.5 bg-gray-50 border border-gray-100 rounded-xl pr-3.5">
                  <img
                    src={user.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.uid}`}
                    alt="avatar"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-lg text-xs"
                  />
                  <div className="hidden sm:block text-left text-xs leading-none">
                    <p className="font-bold text-gray-900">{user.displayName || 'Operator'}</p>
                    <p className="text-[10px] text-gray-400 block mt-0.5 truncate max-w-[120px]">{user.email}</p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-red-650 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                  title="Sign out of sessions"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Main Dashboard Panel workspace */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <AnimatePresence mode="wait">
              {selectedLink ? (
                /* Detail telemetry analytics path */
                <motion.div
                  key="details"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <LinkDetails 
                    link={selectedLink} 
                    onBack={() => setSelectedLink(null)} 
                    onDeleted={() => {
                      setSelectedLink(null);
                    }}
                  />
                </motion.div>
              ) : (
                /* Campaigns stream grid directory view */
                <motion.div
                  key="list"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  {/* KPI summary totals section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <KPICard
                      title="Active Campaigns"
                      value={activeLinksCount}
                      description="Unique tracking urls constructed."
                      icon={<Link2 className="w-5 h-5" />}
                      colorClass="bg-indigo-50 text-indigo-650"
                    />
                    <KPICard
                      title="Total Operational Clicks"
                      value={totalClicks}
                      description="Consolidated geographic entries logged."
                      icon={<Activity className="w-5 h-5 animate-pulse" />}
                      colorClass="bg-emerald-50 text-emerald-650"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Input Tracker Form Generator */}
                    <div className="lg:col-span-1">
                      <LinkGenerator userId={user.uid} onLinkCreated={() => {}} />
                    </div>

                    {/* Right: Listed Campaigns and summary stats */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-gray-950">Your Tracker Campaigns</h3>
                          <p className="text-xs text-gray-400">Chronological catalog of generated tracking pathways.</p>
                        </div>
                      </div>

                      {linksLoading && links.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white border border-gray-100 rounded-2xl">
                          <span className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
                          <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Compiling active streams...</p>
                        </div>
                      ) : links.length === 0 ? (
                        <div className="text-center py-24 bg-white border border-gray-100 rounded-2xl flex flex-col items-center justify-center p-6">
                          <Compass className="w-10 h-10 text-gray-300 mb-3 animate-wiggle" />
                          <p className="text-xs font-bold text-gray-700">No Analytics Channels Active</p>
                          <p className="text-[11px] text-gray-400 max-w-sm mt-1.5 leading-relaxed">
                            Create your absolute first tracking campaign in the generation module on the left.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          {links.map((lnk) => (
                            <motion.div
                              whileHover={{ scale: 1.005, y: -1 }}
                              transition={{ duration: 0.2 }}
                              key={lnk.id}
                              className="bg-white p-5 rounded-2xl border border-gray-100 hover:border-indigo-100 hover:shadow-md hover:shadow-gray-200/50 transition-all flex items-center justify-between gap-4 cursor-pointer"
                              onClick={() => setSelectedLink(lnk)}
                            >
                              <div className="space-y-1 min-w-0">
                                <h4 className="text-xs font-bold text-gray-950 truncate">{lnk.title}</h4>
                                <p className="text-[10px] text-gray-400 block truncate font-mono">
                                  {window.location.origin + window.location.pathname}?t={lnk.id}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                                  <span>Redirects to:</span>
                                  <span className="text-indigo-600 font-semibold truncate max-w-[200px] hover:underline" title={lnk.destinationUrl}>
                                    {lnk.destinationUrl}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right">
                                  <p className="text-xs font-extrabold text-indigo-650 bg-indigo-50/70 p-2 py-1 rounded-xl block leading-none">
                                    {lnk.clicksCount} Click{lnk.clicksCount !== 1 && 's'}
                                  </p>
                                  <p className="text-[9px] text-gray-400 mt-1 leading-none font-mono">
                                    {new Date(lnk.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      )}
    </div>
  );
}
