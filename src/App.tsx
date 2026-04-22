/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  History as HistoryIcon, 
  User, 
  Mail, 
  LogOut, 
  Moon, 
  Sun, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  ChevronUp,
  Search,
  Download,
  Trash2,
  Camera,
  MapPin,
  Shield,
  Activity,
  Wind,
  LayoutDashboard,
  Settings,
  MoreVertical,
  Menu,
  X as CloseIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { auth, signInWithGoogle } from './lib/firebase';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { SmokeOverlay, cn } from './lib/utils';
import { ImageCropper } from './components/ImageCropper';

// Types
interface UserData {
  id: string;
  employee_id?: string;
  full_name: string;
  email: string;
  position: string;
  role: string;
  photo_url?: string;
  emergency_contact?: string;
  date_joined: string;
  last_login: string;
}

interface NodeStat {
  id: number;
  node_code: string;
  location_name: string;
  floor: string;
  is_active: number;
  pm1_0: number | null;
  pm2_5: number | null;
  pm10: number | null;
  aqi_value: number | null;
  aqi_category: string | null;
  smoke_detected: number;
  recorded_at: string | null;
}

const socket = io();

export default function App() {
  const [currentPage, setCurrentPage] = useState<'login' | 'signup' | 'forgot' | 'dashboard' | 'history' | 'profile' | 'contact'>('login');
  const [loggedInUser, setLoggedInUser] = useState<UserData | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [nodes, setNodes] = useState<NodeStat[]>([]);
  const [alertOpen, setAlertOpen] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<any>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const alertAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Firebase Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Firebase Auth Resolved:', !!user);
      if (user) {
        setLoggedInUser({
          id: user.uid,
          full_name: user.displayName || 'User',
          email: user.email || '',
          photo_url: user.photoURL || undefined,
          position: 'Staff / Teacher',
          role: user.email === 'toxicg332@gmail.com' ? 'Admin' : 'Staff',
          date_joined: '2026-04-22',
          last_login: new Date().toISOString()
        });
        setCurrentPage('dashboard');
      } else {
        setLoggedInUser(null);
        setCurrentPage('login');
      }
      setAuthResolved(true);
    }, (err) => {
      console.error('Auth error:', err);
      setAuthResolved(true);
    });

    // Force resolution limit
    const timer = setTimeout(() => {
      console.log('Force resolving auth state');
      setAuthResolved(true);
    }, 2000);

    socket.on('vape_detected', (data) => {
      setCurrentAlert(data);
      setAlertOpen(true);
      if (alertAudio.current) {
        alertAudio.current.play().catch(e => console.log('Audio overlap ignored', e));
      }
    });

    socket.on('reading_updated', (data) => {
      setNodes(prev => prev.map(n => n.id === data.nodeId ? { ...n, ...data } : n));
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
      socket.off('vape_detected');
      socket.off('reading_updated');
    };
  }, []);

  const handleLocalBypass = () => {
    setLoggedInUser({
      id: 'dev-user-001',
      full_name: 'Developer (Local)',
      email: 'dev@localhost',
      position: 'Administrator',
      role: 'Admin',
      date_joined: new Date().toISOString(),
      last_login: new Date().toISOString()
    });
    setCurrentPage('dashboard');
  };

  if (renderError) {
    return (
      <div className="h-screen w-screen bg-red-600 text-white p-12 flex flex-col items-center justify-center">
        <h1 className="text-4xl font-black mb-4">SYSTEM ERROR</h1>
        <pre className="bg-black/20 p-6 rounded-2xl w-full max-w-2xl overflow-auto">{renderError}</pre>
        <button onClick={() => window.location.reload()} className="mt-8 px-8 py-4 bg-white text-red-600 rounded-full font-black">RELOAD SYSTEM</button>
      </div>
    );
  }

  if (!authResolved) {
    return (
      <div style={{
        height: '100vh', 
        width: '100vw', 
        backgroundColor: '#0088CC', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        color: 'white',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ fontSize: '3rem', fontWeight: '900', fontStyle: 'italic', marginBottom: '1rem' }}>FRESHZONE</div>
        <div style={{ opacity: 0.6, fontSize: '0.8rem', letterSpacing: '0.1em' }}>INITIALIZING SECURE SYSTEM...</div>
      </div>
    );
  }

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (loggedInUser && currentPage === 'dashboard') {
      fetch('/api/dashboard/status')
        .then(res => res.json())
        .then(data => setNodes(data.stats));
    }
  }, [loggedInUser, currentPage]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      alert('Failed to sign in with Google');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCroppingImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async (croppedImage: string) => {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { photoURL: croppedImage });
      setLoggedInUser(prev => prev ? { ...prev, photo_url: croppedImage } : null);
    }
    setCroppingImage(null);
  };

  const handleExportCSV = () => {
    window.location.href = '/api/history/export';
  };

  const NavItem = ({ id, label, icon: Icon }: { id: any, label: string, icon: any }) => {
    const active = currentPage === id;
    return (
      <button 
        onClick={() => {
          setCurrentPage(id);
          setMobileMenuOpen(false);
        }}
        className={cn(
          "flex items-center gap-3 px-6 py-3 rounded-2xl font-bold transition-all w-full",
          active 
            ? "bg-brand-cyan text-white shadow-lg shadow-brand-cyan/20 scale-105" 
            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        <Icon size={20} />
        <span className="md:block">{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen relative font-sans overflow-x-hidden">
      {/* SmokeOverlay moved inside content areas to prevent global blocking */}
      
      <AnimatePresence>
        {alertOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flashing-red flex flex-col items-center justify-center text-white px-4 text-center pointer-events-auto"
          >
            <div className="bg-slate-900/40 p-12 rounded-[48px] backdrop-blur-3xl border border-white/20 shadow-2xl scale-125">
              <AlertTriangle size={80} className="mx-auto mb-8 animate-bounce text-red-500" />
              <h1 className="text-7xl font-display font-black tracking-tighter mb-4 italic uppercase">VAPE DETECTED</h1>
              <p className="text-3xl font-semibold mb-2">{currentAlert?.location}</p>
              <p className="text-xl opacity-80 mb-12">PM2.5: {currentAlert?.pm2_5} µg/m³ | AQI: {currentAlert?.aqi_value}</p>
              <button 
                onClick={() => {
                  setAlertOpen(false);
                  if (alertAudio.current) {
                    alertAudio.current.pause();
                    alertAudio.current.currentTime = 0;
                  }
                }}
                className="bg-white text-red-600 px-12 py-5 rounded-3xl font-black text-2xl hover:scale-105 active:scale-95 transition-all shadow-xl"
              >
                I AM ON MY WAY
              </button>
            </div>
            <audio ref={alertAudio} src="https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3" loop />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {croppingImage && (
          <ImageCropper 
            image={croppingImage} 
            onCropComplete={handleCropComplete} 
            onCancel={() => setCroppingImage(null)} 
          />
        )}
      </AnimatePresence>

      <main className="relative z-10">
        {!loggedInUser ? (
          <div className="flex flex-col items-center justify-center min-h-screen px-4">
            <SmokeOverlay />
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center mb-12 text-white"
            >
              <h1 className="text-6xl md:text-8xl font-display font-black tracking-tighter italic uppercase drop-shadow-lg">FreshZone</h1>
              <p className="text-xl md:text-2xl font-medium opacity-90 mt-4 max-w-lg mx-auto">Campus monitoring for a cleaner, safer breathing space.</p>
            </motion.div>

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md auth-card"
            >
              <div className="space-y-8">
                <button 
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-4 bg-white py-4 rounded-2xl text-slate-800 font-bold text-lg hover:bg-slate-50 transition-all shadow-xl active:scale-[0.98]"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
                  Continue with Google / Gmail
                </button>

                {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                  <button 
                    onClick={handleLocalBypass}
                    className="w-full py-4 rounded-2xl bg-white/5 border border-white/20 text-white font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    Local Developer Login (Bypass)
                  </button>
                )}
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                  <div className="relative flex justify-center text-xs uppercase font-black text-white/40 tracking-widest bg-transparent">
                    <span className="px-4">Campus Faculty Access Only</span>
                  </div>
                </div>

                <div className="text-center text-white/60 text-sm font-medium">
                  By signing in, you agree to follow school monitoring protocols and privacy standards.
                </div>
              </div>
            </motion.div>
            
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="mt-12 bg-white/10 p-4 rounded-full text-white hover:bg-white/20 transition-all"
            >
              {darkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row min-h-screen bg-transparent">
            {/* Desktop Sidebar / Mobile Nav Wrapper */}
            <aside className={cn(
              "fixed md:sticky top-0 left-0 z-50 h-screen w-72 md:bg-white/10 dark:md:bg-slate-900/20 backdrop-blur-3xl border-r border-white/10 p-8 flex flex-col justify-between transition-transform duration-500",
              "md:translate-x-0",
              mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
              <div className="space-y-12">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-brand-cyan rounded-2xl flex items-center justify-center text-white rotate-3 shadow-lg shadow-brand-cyan/20">
                    <Shield size={28} />
                  </div>
                  <h2 className="font-display font-black text-3xl italic text-white tracking-tighter">FRESHZONE</h2>
                </div>

                <nav className="space-y-2">
                  <NavItem id="dashboard" label="Dashboard" icon={LayoutDashboard} />
                  <NavItem id="history" label="Alert Logs" icon={HistoryIcon} />
                  <NavItem id="profile" label="Settings" icon={Settings} />
                  <NavItem id="contact" label="Reports" icon={Mail} />
                </nav>
              </div>

              <div className="space-y-6 pt-12 border-t border-white/10">
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10">
                  <div className="w-12 h-12 rounded-2xl bg-brand-cyan overflow-hidden overflow-hidden">
                    {loggedInUser.photo_url ? <img src={loggedInUser.photo_url} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-white" />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="font-black text-white text-sm truncate">{loggedInUser.full_name}</h3>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{loggedInUser.role}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full py-4 bg-red-500/20 text-red-500 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2">
                  Logout <LogOut size={18} />
                </button>
              </div>

              <button onClick={() => setMobileMenuOpen(false)} className="md:hidden absolute top-6 right-6 text-white bg-white/10 p-3 rounded-full">
                <CloseIcon size={24} />
              </button>
            </aside>

            {/* Mobile Header */}
            <header className="md:hidden fixed top-0 w-full z-40 bg-white/10 backdrop-blur-3xl border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <Shield className="text-brand-cyan" size={24} />
                 <h2 className="font-display font-black text-xl italic text-white">FZ</h2>
              </div>
              <div className="flex items-center gap-4">
                 <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-white bg-white/10 rounded-full">
                   {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                 </button>
                 <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-white bg-brand-cyan rounded-full shadow-lg">
                   <Menu size={24} />
                 </button>
              </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 p-6 md:p-12 mt-16 md:mt-0 max-w-7xl mx-auto w-full relative">
              <SmokeOverlay />
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentPage}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentPage === 'dashboard' && (
                    <div className="space-y-8">
                       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          <div className="lg:col-span-2 space-y-8">
                             <div className="glass-card p-12 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                                <h1 className="text-5xl font-display font-black text-dark-blue dark:text-white tracking-tighter italic uppercase mb-2">Campus Air Quality</h1>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2 italic">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Secure monitoring online
                                </p>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
                                  {[
                                    { label: 'Avg PM2.5', value: '12.4', unit: 'µg/m³', color: 'text-brand-blue' },
                                    { label: 'Nodes Active', value: '2', unit: '/2', color: 'text-brand-cyan' },
                                    { label: 'Alerts Today', value: '0', unit: 'Total', color: 'text-red-500' },
                                    { label: 'Campus Safety', value: '100', unit: '%', color: 'text-green-500' },
                                  ].map((stat, i) => (
                                    <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800">
                                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</div>
                                      <div className={cn("text-3xl font-display font-black tracking-tight italic", stat.color)}>{stat.value}</div>
                                      <div className="text-[10px] font-bold text-slate-400 mt-1">{stat.unit}</div>
                                    </div>
                                  ))}
                                </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {nodes.map(node => (
                                  <div key={node.id} className={cn(
                                    "glass-card p-8 group hover:scale-[1.02] active:scale-[0.98]",
                                    node.smoke_detected && "ring-4 ring-red-500 animate-pulse border-transparent bg-red-50 dark:bg-red-950/20"
                                  )}>
                                     <div className="flex justify-between items-start mb-6">
                                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-3xl text-dark-blue dark:text-brand-cyan">
                                           <MapPin size={24} />
                                        </div>
                                        <div className="text-right">
                                           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{node.node_code}</div>
                                           <div className="text-lg font-black text-dark-blue dark:text-white italic tracking-tighter">{node.location_name}</div>
                                        </div>
                                     </div>

                                     <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                           <div>
                                              <div className="text-xs font-bold text-slate-400 uppercase">Current PM2.5</div>
                                              <div className={cn("text-4xl font-display font-black italic", node.smoke_detected ? "text-red-500" : "text-brand-blue dark:text-brand-cyan")}>
                                                {node.pm2_5 || '0.0'}
                                              </div>
                                           </div>
                                           <div className="text-right font-black italic text-xs uppercase py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800">
                                              AQI {node.aqi_value || '--'}
                                           </div>
                                        </div>
                                        
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                           <div className={cn("h-full rounded-full transition-all duration-1000", node.smoke_detected ? "bg-red-500 w-full" : "bg-brand-cyan w-1/3")}></div>
                                        </div>
                                     </div>
                                  </div>
                                ))}
                             </div>
                          </div>

                          <div className="lg:col-span-1 space-y-8">
                             <div className="glass-card p-8 flex flex-col h-full">
                                <h2 className="text-2xl font-display font-black text-dark-blue dark:text-white italic tracking-tighter uppercase mb-6 flex items-center gap-2">
                                   <Activity className="text-brand-cyan" size={24} /> Recent Alerts
                                </h2>
                                
                                <div className="space-y-4 flex-1">
                                   {[1, 2, 3].map(i => (
                                     <div key={i} className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer">
                                        <div className="w-2 h-12 bg-slate-200 dark:bg-slate-700 rounded-full shrink-0"></div>
                                        <div>
                                           <h4 className="text-sm font-black text-dark-blue dark:text-white italic">Node {i} Cleared</h4>
                                           <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Today at 10:4{i} AM</p>
                                        </div>
                                     </div>
                                   ))}
                                </div>
                                
                                <button onClick={() => setCurrentPage('history')} className="mt-8 w-full py-4 border-2 border-slate-100 dark:border-slate-800 text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                   View Full Log
                                </button>
                             </div>
                          </div>
                       </div>
                    </div>
                  )}

                  {currentPage === 'history' && (
                    <div className="space-y-8">
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                           <div>
                              <h1 className="text-5xl font-display font-black text-dark-blue dark:text-white tracking-tighter italic uppercase">Alert Logs</h1>
                              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2 italic">Comprehensive history of detection events</p>
                           </div>
                           <div className="flex gap-3">
                              <button onClick={handleExportCSV} className="bg-green-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-green-200 flex items-center gap-2 hover:translate-y-[-2px] transition-all">
                                 <Download size={18} /> Export CSV
                              </button>
                              {loggedInUser.role === 'Admin' && (
                                <button className="bg-red-500/10 text-red-500 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">
                                   Clear All
                                </button>
                              )}
                           </div>
                       </div>

                       <div className="glass-card overflow-hidden">
                          <div className="overflow-x-auto">
                             <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                   <tr>
                                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">PM 2.5</th>
                                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                   {[1, 2, 3, 4, 5].map(i => (
                                     <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all font-bold">
                                        <td className="px-8 py-6">
                                           <div className="text-slate-800 dark:text-white text-sm">Apr 22, 10:2{i}</div>
                                           <div className="text-[10px] text-slate-400 uppercase tracking-tighter">Automatic Log</div>
                                        </td>
                                        <td className="px-8 py-6 italic text-brand-blue dark:text-brand-cyan">
                                           4th Floor Male CR
                                        </td>
                                        <td className="px-8 py-6 font-mono font-black">
                                           12.{i} µg/m³
                                        </td>
                                        <td className="px-8 py-6">
                                           <span className="px-4 py-1.5 rounded-full bg-green-100 text-green-600 text-[10px] font-black italic uppercase">Cleared</span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                           <button className="text-slate-300 hover:text-dark-blue dark:hover:text-white"><MoreVertical size={20} /></button>
                                        </td>
                                     </tr>
                                   ))}
                                </tbody>
                             </table>
                          </div>
                       </div>
                    </div>
                  )}

                  {currentPage === 'profile' && (
                    <div className="max-w-4xl mx-auto space-y-12">
                       <div className="flex items-center gap-8 bg-white/10 p-12 rounded-[48px] backdrop-blur-3xl border border-white/20">
                          <div className="relative group shrink-0">
                             <div className="w-48 h-48 rounded-[40px] bg-white overflow-hidden shadow-2xl border-8 border-white/10 ring-1 ring-white/20">
                                {loggedInUser.photo_url ? (
                                  <img src={loggedInUser.photo_url} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-brand-cyan text-white text-6xl font-black">
                                     {loggedInUser.full_name[0]}
                                  </div>
                                )}
                             </div>
                             <label className="absolute -bottom-4 -right-4 bg-brand-cyan text-white p-5 rounded-[24px] shadow-xl cursor-pointer hover:scale-110 active:scale-95 transition-all border-4 border-slate-900 border-none">
                                <Camera size={28} />
                                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                             </label>
                          </div>
                          
                          <div className="space-y-4">
                             <h1 className="text-6xl font-display font-black text-white tracking-tighter italic uppercase leading-none">{loggedInUser.full_name}</h1>
                             <div className="flex gap-3">
                                <span className="bg-brand-cyan/20 text-brand-cyan px-4 py-1.5 rounded-full text-xs font-black italic uppercase tracking-widest">{loggedInUser.role}</span>
                                <span className="bg-white/10 text-white/40 px-4 py-1.5 rounded-full text-xs font-black italic uppercase tracking-widest">ID: {loggedInUser.id.slice(0, 8)}</span>
                             </div>
                             <p className="text-white/60 font-medium text-lg leading-snug">Main administrator for campus security and environmental oversight.</p>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="glass-card p-12 space-y-8 italic">
                             <h3 className="text-2xl font-display font-black text-dark-blue dark:text-white tracking-tighter uppercase mb-2">Account Details</h3>
                             <div className="space-y-6">
                                {[
                                  { label: 'Full Display Name', value: loggedInUser.full_name },
                                  { label: 'Registered Email', value: loggedInUser.email },
                                  { label: 'Primary Role', value: loggedInUser.position },
                                  { label: 'Monitoring Rank', value: 'Level 1 Response' },
                                ].map((field, i) => (
                                  <div key={i} className="group cursor-text">
                                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{field.label}</label>
                                     <div className="text-lg font-bold text-dark-blue dark:text-white tracking-tight border-b border-slate-100 dark:border-slate-800 pb-2 group-hover:border-brand-cyan transition-colors">
                                       {field.value}
                                     </div>
                                  </div>
                                ))}
                             </div>
                          </div>

                          <div className="glass-card p-12 flex flex-col justify-between italic">
                             <div className="space-y-6">
                                <h3 className="text-2xl font-display font-black text-dark-blue dark:text-white tracking-tighter uppercase mb-2">Preference</h3>
                                <div className="space-y-6">
                                   <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-3xl">
                                      <div className="flex items-center gap-4">
                                         {darkMode ? <Moon className="text-brand-cyan" /> : <Sun className="text-yellow-500" />}
                                         <span className="font-black text-sm uppercase tracking-widest">Dark Aesthetic</span>
                                      </div>
                                      <button 
                                        onClick={() => setDarkMode(!darkMode)}
                                        className={cn(
                                          "w-12 h-6 rounded-full p-1 transition-all",
                                          darkMode ? "bg-brand-cyan" : "bg-slate-300"
                                        )}
                                      >
                                         <div className={cn("w-4 h-4 bg-white rounded-full transition-all", darkMode ? "translate-x-6" : "translate-x-0")} />
                                      </button>
                                   </div>

                                   <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-3xl">
                                      <div className="flex items-center gap-4">
                                         <Bell className="text-brand-blue" />
                                         <span className="font-black text-sm uppercase tracking-widest">Alert Sounds</span>
                                      </div>
                                      <div className="w-12 h-6 bg-brand-cyan rounded-full p-1"><div className="w-4 h-4 bg-white rounded-full translate-x-6" /></div>
                                   </div>
                                </div>
                             </div>

                             <button className="w-full mt-12 py-5 bg-dark-blue dark:bg-brand-cyan text-white dark:text-slate-950 font-black tracking-widest uppercase text-sm rounded-3xl shadow-xl shadow-dark-blue/20">
                                Save All Changes
                             </button>
                          </div>
                       </div>
                    </div>
                  )}

                  {currentPage === 'contact' && (
                     <div className="max-w-3xl mx-auto space-y-12 italic">
                        <div className="text-center space-y-4">
                           <h1 className="text-6xl font-display font-black text-dark-blue dark:text-white tracking-tighter italic uppercase">Admin Reports</h1>
                           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2 italic">Direct communication with campus support</p>
                        </div>
                        
                        <div className="glass-card p-12">
                           <form className="space-y-8">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                 <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Report Type</label>
                                    <select className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold text-dark-blue dark:text-white appearance-none">
                                       <option>Device Maintenance</option>
                                       <option>False Alert Feedback</option>
                                       <option>System Performance</option>
                                    </select>
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Urgency</label>
                                    <select className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold text-dark-blue dark:text-white appearance-none">
                                       <option>Standard</option>
                                       <option>High Priority</option>
                                       <option>Critical</option>
                                    </select>
                                 </div>
                              </div>
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block text-right">Message Context</label>
                                 <textarea className="w-full px-8 py-6 bg-slate-50 dark:bg-slate-800 rounded-[32px] border-none font-bold text-dark-blue dark:text-white min-h-[200px]" placeholder="Detailed description of the monitoring event..."></textarea>
                              </div>
                              <button className="w-full py-6 bg-brand-cyan text-white font-black uppercase text-lg tracking-tighter rounded-3xl shadow-xl shadow-brand-cyan/20 flex items-center justify-center gap-4">
                                 <Mail size={24} /> Submit Response
                              </button>
                           </form>
                        </div>
                     </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            
            <button className="fixed bottom-8 right-8 z-30 w-16 h-16 bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl flex items-center justify-center text-dark-blue dark:text-white hover:scale-110 active:scale-95 transition-all md:hidden">
               <ChevronUp size={32} />
            </button>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-1 bg-white/20 z-[1001] pointer-events-none">
        <div 
          className="h-full bg-brand-cyan transition-all duration-[10s] ease-linear"
          style={{ width: '100%' }}
        />
      </footer>
    </div>
  );
}
