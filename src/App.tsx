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
  Droplets,
  Wind
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';

// Types
interface UserData {
  id: number;
  employee_id: string;
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
  const [loading, setLoading] = useState(true);

  const alertAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setLoggedInUser(data.user);
          setCurrentPage('dashboard');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

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
      socket.off('vape_detected');
      socket.off('reading_updated');
    };
  }, []);

  useEffect(() => {
    if (loggedInUser && currentPage === 'dashboard') {
      fetch('/api/dashboard/status')
        .then(res => res.json())
        .then(data => setNodes(data.stats));
    }
  }, [loggedInUser, currentPage]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get('email');
    const password = formData.get('password');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (data.user) {
      setLoggedInUser(data.user);
      setCurrentPage('dashboard');
    } else {
      alert(data.error || 'Login failed');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setLoggedInUser(null);
    setCurrentPage('login');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const payload = Object.fromEntries(formData.entries());
    
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      alert('Account created! Please log in.');
      setCurrentPage('login');
    } else {
      const data = await res.json();
      alert(data.error || 'Signup failed');
    }
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const subject = formData.get('subject');
    const message = formData.get('message');
    
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, message })
    });
    
    if (res.ok) {
      alert('Report submitted successfully!');
      (e.target as HTMLFormElement).reset();
    } else {
      alert('Failed to submit report');
    }
  };

  const handleExportCSV = () => {
    window.location.href = '/api/history/export';
  };

  const handleDeleteHistory = async () => {
    if (!confirm('Are you sure you want to PERMANENTLY delete all detection history? This cannot be undone.')) return;
    const res = await fetch('/api/history/all', { method: 'DELETE' });
    if (res.ok) {
      alert('History cleared successfully');
    } else {
      alert('Failed to delete history');
    }
  };

  if (loading) return <div className="h-screen w-screen bg-brand-blue flex items-center justify-center text-white font-bold text-2xl">Loading FreshZone...</div>;

  return (
    <div className={`${darkMode ? 'dark' : ''} min-h-screen relative`}>
      <AnimatePresence>
        {alertOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flashing-red flex flex-col items-center justify-center text-white px-4 text-center"
          >
            <div className="bg-white/10 p-12 rounded-[48px] backdrop-blur-lg border border-white/20 shadow-2xl">
              <div className="bg-white text-red-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                <AlertTriangle size={60} />
              </div>
              <h1 className="text-7xl font-display font-black tracking-tighter mb-4 italic">VAPE DETECTED!</h1>
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
                className="bg-white text-red-600 px-12 py-5 rounded-3xl font-black text-2xl hover:bg-slate-100 transition-all shadow-xl active:scale-95"
              >
                I Acknowledge
              </button>
            </div>
            <audio ref={alertAudio} src="https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3" loop />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="min-h-screen">
        {!loggedInUser ? (
          <div className="flex flex-col items-center justify-center min-h-screen px-4 animate-in fade-in duration-700">
            <div className="text-center mb-12 text-white max-w-md">
              <h1 className="text-6xl font-display font-bold tracking-tight mb-2">Welcome to</h1>
              <h2 className="text-7xl font-display font-black tracking-tighter italic">FreshZone</h2>
              <p className="text-lg opacity-80 mt-4 leading-snug font-medium">Campus vape aerosol detection system — keeping your school environment safe and compliant.</p>
            </div>

            <div className="w-full max-w-[480px] auth-card">
              <div className="flex justify-center mb-8">
                <div className="w-48 h-16 bg-slate-100 rounded-full flex items-center justify-center px-4">
                   <div className="flex items-center gap-2">
                     <div className="w-10 h-10 bg-brand-blue rounded-full flex items-center justify-center text-white">
                       <Shield size={24} />
                     </div>
                     <span className="font-display font-black text-dark-blue italic text-xl">FRESHZONE</span>
                   </div>
                </div>
              </div>

              {currentPage === 'login' && (
                <form onSubmit={handleLogin} className="space-y-6">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Email or Phone Number</label>
                    <input name="email" type="text" className="input-field" placeholder="email@gmail.com" required />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Password</label>
                    <input name="password" type="password" className="input-field" placeholder="••••••••••••••••" required />
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300" id="stay" />
                    <label htmlFor="stay" className="text-xs font-bold text-slate-600 uppercase tracking-wider">Stay Logged In</label>
                  </div>
                  <button type="submit" className="btn-primary text-lg tracking-tight h-14 bg-[#004466]">Sign In</button>
                  <div className="text-center space-y-2">
                    <p className="text-slate-500 font-medium">New here? <button type="button" onClick={() => setCurrentPage('signup')} className="text-brand-blue font-bold">Create account</button></p>
                    <button type="button" onClick={() => setCurrentPage('forgot')} className="text-brand-cyan font-bold text-sm">Forgot your password?</button>
                  </div>
                </form>
              )}

              {currentPage === 'signup' && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Full Name</label>
                      <input name="full_name" className="input-field py-2" placeholder="John Doe" required />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Employee ID</label>
                      <input name="employee_id" className="input-field py-2" placeholder="02XXXXXX" required />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Email Address</label>
                    <input name="email" className="input-field py-2" placeholder="name@gmail.com" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Contact Number</label>
                    <input name="contact_number" className="input-field py-2" placeholder="+63 9xx xxx xxxx" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Position</label>
                    <select name="position" className="input-field py-2" required>
                      <option value="">Select your position</option>
                      <option>Administrator</option>
                      <option>Staff / Teachers</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Password</label>
                    <input name="password" title="password" className="input-field py-2" type="password" placeholder="Min. 8 characters" required />
                  </div>
                  <button type="submit" className="btn-primary mt-4 py-4 bg-[#004466]">Create Account</button>
                  <p className="text-center text-slate-500 font-medium">Already have an account? <button type="button" onClick={() => setCurrentPage('login')} className="text-brand-blue font-bold">Sign In</button></p>
                </form>
              )}

              {currentPage === 'forgot' && (
                 <div className="space-y-6">
                    <div className="bg-cyan-50 border border-cyan-100 p-6 rounded-3xl text-sm text-dark-blue font-medium leading-relaxed">
                      Enter your registered email to reset your password.
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Registered Email</label>
                      <input className="input-field" placeholder="name@gmail.com" />
                    </div>
                    <button className="btn-primary py-4 bg-[#004466]">Send Reset Code</button>
                    <button onClick={() => setCurrentPage('login')} className="w-full text-brand-blue font-bold flex items-center justify-center gap-2">
                      ← Back to Login
                    </button>
                 </div>
              )}
            </div>
            
            <div className="mt-8 flex gap-4">
               <button onClick={() => setDarkMode(!darkMode)} className="w-12 h-10 bg-black/10 backdrop-blur rounded-2xl flex items-center justify-center text-white hover:bg-black/20 transition-all border border-white/10">
                 <Moon size={20} />
               </button>
            </div>
            
            <footer className="mt-12 text-white/60 font-medium text-xs text-center flex flex-col items-center gap-1">
              <span>© 2026 FreshZone — Campus Vape Aerosol</span>
              <span>Detection System</span>
            </footer>
          </div>
        ) : (
          <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 pb-12">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-brand-blue rounded-full flex items-center justify-center text-white">
                  <Shield size={24} />
                </div>
                <div className="flex flex-col">
                  <span className="font-display font-black text-dark-blue italic text-lg leading-tight uppercase">FRESHZONE</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none">VAPE SMOKE DETECTOR</span>
                </div>
              </div>
              
              <nav className="flex items-center gap-1">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: Activity },
                  { id: 'history', label: 'History', icon: HistoryIcon },
                  { id: 'profile', label: 'Profile', icon: User },
                  { id: 'contact', label: 'Contact', icon: Mail },
                ].map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => setCurrentPage(item.id as any)}
                    className={`px-6 py-2 rounded-full font-bold transition-all transition-all ${currentPage === item.id ? 'bg-dark-blue text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    {item.label}
                  </button>
                ))}
                <div className="h-8 w-px bg-slate-300 mx-4"></div>
                <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 font-bold hover:text-red-500 transition-all">
                  Logout <LogOut size={18} />
                </button>
                <div className="ml-4 flex items-center gap-3 bg-slate-100 rounded-full pl-5 pr-2 py-1 select-none">
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-dark-blue leading-tight tracking-tight">{loggedInUser.full_name}</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center font-black">
                    {loggedInUser.photo_url ? <img src={loggedInUser.photo_url} className="w-full h-full rounded-full object-cover" /> : loggedInUser.full_name[0]}
                  </div>
                  <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-slate-500 active:scale-90 bg-white rounded-full shadow-sm">
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                  <div className="relative">
                    <Bell size={20} className="text-slate-400" />
                    <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="flex items-center gap-2 bg-brand-cyan/20 px-3 py-1 rounded-full ml-1">
                     <div className="w-2.5 h-2.5 bg-brand-cyan rounded-full animate-pulse"></div>
                     <span className="text-[10px] font-black text-brand-cyan uppercase tracking-tighter italic">ON</span>
                  </div>
                </div>
              </nav>
            </header>

            <div className="flex-1 w-full max-w-7xl mx-auto px-8 pt-12">
              {currentPage === 'dashboard' && (
                <div className="space-y-12 animate-in slide-in-from-bottom duration-500">
                  <div className="bg-white p-12 rounded-[48px] shadow-xl text-center space-y-6 border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-blue to-brand-cyan"></div>
                    <div className="space-y-2">
                       <h1 className="text-6xl font-display font-bold text-dark-blue tracking-tighter">Campus Vape Aerosol Detector <span className="inline-flex items-center gap-2 bg-green-100 text-green-600 px-4 py-1 rounded-full text-base ml-2 font-black italic"><span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span> LIVE</span></h1>
                       <p className="text-xl text-slate-400 font-bold uppercase tracking-tight italic">Logged in as {loggedInUser.full_name} — {loggedInUser.position}</p>
                    </div>
                    <div className="flex justify-center">
                      <button onClick={() => setCurrentPage('history')} className="btn-cyan h-16 px-12 text-xl italic font-black shadow-lg shadow-brand-cyan/30 rounded-2xl">View Detection History</button>
                    </div>
                  </div>

                  <div className="text-center text-slate-400 font-bold text-xs uppercase tracking-widest mt-12 mb-4">
                    Last updated: {new Date().toLocaleTimeString()} — Auto-refreshes every 5 seconds
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                    {nodes.map(node => (
                       <div key={node.id} className={`bg-white rounded-[32px] p-8 shadow-xl border-t-8 transition-all hover:translate-y-[-4px] overflow-hidden group ${node.smoke_detected ? 'border-red-500 ring-4 ring-red-500/20' : node.is_active ? 'border-green-500' : 'border-slate-300 opacity-80'}`}>
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                               <div className={`p-4 rounded-3xl ${node.smoke_detected ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-500'}`}>
                                 <User size={32} />
                               </div>
                               <div>
                                 <h3 className="text-2xl font-black text-dark-blue tracking-tighter">{node.location_name}</h3>
                                 <div className="flex items-center gap-2 mt-1">
                                    <div className={`w-2 h-2 rounded-full ${node.smoke_detected ? 'bg-red-500 animate-ping' : node.is_active ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                                    <span className={`text-sm font-black uppercase tracking-tight italic ${node.smoke_detected ? 'text-red-500 animate-pulse' : node.is_active ? 'text-green-500' : 'text-slate-400'}`}>
                                      {node.smoke_detected ? 'VAPE AEROSOL DETECTED' : node.is_active ? 'Air Clear' : 'Sensor Offline'}
                                    </span>
                                 </div>
                               </div>
                            </div>
                            <div className="h-10 w- px-4 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-slate-400 border border-slate-100 italic">
                               AQI: {node.aqi_value || '—'}
                            </div>
                          </div>

                          {node.is_active && !node.smoke_detected ? (
                            <div className="space-y-6">
                              <div className="bg-yellow-100 text-yellow-700 px-6 py-3 rounded-2xl font-black text-sm uppercase italic border border-yellow-200 tracking-tight">
                                AQI: {node.aqi_value} — {node.aqi_category}
                              </div>
                              <div className="flex gap-3">
                                 {[
                                   { label: 'PM1.0', val: node.pm1_0 },
                                   { label: 'PM2.5', val: node.pm2_5 },
                                   { label: 'PM10', val: node.pm10 },
                                 ].map(p => (
                                   <div key={p.label} className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center group-hover:bg-slate-100 transition-all">
                                      <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">{p.label}</div>
                                      <div className="text-sm font-black text-dark-blue tracking-tight leading-none italic">{p.val} µg/m³</div>
                                   </div>
                                 ))}
                              </div>
                            </div>
                          ) : node.smoke_detected ? (
                            <div className="space-y-6">
                               <div className="bg-red-100 text-red-600 px-6 py-3 rounded-2xl font-black text-sm uppercase italic border border-red-200 tracking-tight">
                                 AQI: {node.aqi_value} — {node.aqi_category}
                               </div>
                               <div className="flex gap-3">
                                  {[
                                    { label: 'PM1.0', val: node.pm1_0 },
                                    { label: 'PM2.5', val: node.pm2_5 },
                                    { label: 'PM10', val: node.pm10 },
                                  ].map(p => (
                                    <div key={p.label} className="flex-1 bg-red-50 border border-red-100 p-3 rounded-2xl text-center">
                                       <div className="text-[10px] font-bold text-red-400 uppercase leading-none mb-1">{p.label}</div>
                                       <div className="text-sm font-black text-red-600 tracking-tight leading-none italic">{p.val} µg/m³</div>
                                    </div>
                                  ))}
                               </div>
                               <button onClick={() => fetch(`/api/events/${node.id}/acknowledge`, { method: 'POST' })} className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-lg shadow-lg shadow-red-200 active:scale-95 transition-all">Acknowledge Alert</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-slate-400 text-sm font-bold opacity-60">
                               <MapPin size={16} /> Last seen: {node.recorded_at ? new Date(node.recorded_at).toLocaleTimeString() : 'Unknown'}
                            </div>
                          )}
                          
                          {node.recorded_at && (
                             <div className="mt-4 pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-300 uppercase italic">
                               Last reading from {node.location_name}: {new Date(node.recorded_at).toLocaleTimeString()}
                             </div>
                          )}
                       </div>
                    ))}
                  </div>

                   <div className="flex justify-center mt-24">
                      <p className="text-sm text-slate-400 font-bold italic tracking-tight">© 2026 FreshZone — Campus Vape Aerosol Detection System</p>
                   </div>
                </div>
              )}

              {currentPage === 'history' && (
                 <div className="space-y-8 animate-in slide-in-from-bottom duration-500 pb-24">
                    <div className="bg-white p-12 rounded-[48px] shadow-xl text-center space-y-6 border border-slate-100 relative overflow-hidden">
                       <div className="bg-[#00BBDE15] w-24 h-24 rounded-full flex items-center justify-center mx-auto text-brand-cyan">
                          <Activity size={48} />
                       </div>
                       <h1 className="text-6xl font-display font-bold text-dark-blue tracking-tighter">Detection History</h1>
                       <p className="text-xl text-slate-400 font-bold uppercase tracking-tight italic">Complete archive of on-campus vape aerosol detection events</p>
                       <div className="flex justify-center">
                          <div className="w-32 h-32 bg-red-50 rounded-full flex items-center justify-center p-4">
                             <div className="relative">
                               <div className="w-16 h-16 text-slate-300">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-vibrate"><path d="m2 8 2 2-2 2 2 2-2 2"/><path d="m22 8-2 2 2 2-2 2 2 2"/><path d="M8 5h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>
                               </div>
                               <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-12 h-1 bg-red-600 rotate-45 rounded-full ring-4 ring-white shadow-lg"></div>
                               </div>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                       {[
                         { label: "Today's Alerts", count: 5, color: 'text-red-500', icon: AlertTriangle },
                         { label: "Total Records", count: 21, color: 'text-brand-cyan', icon: Activity },
                         { label: "Resolved", count: 19, color: 'text-green-500', icon: CheckCircle },
                       ].map(s => (
                         <div key={s.label} className="bg-white p-8 rounded-[32px] shadow-lg text-center border border-slate-100 transition-all hover:bg-slate-50">
                            <div className="flex items-center justify-center gap-2 mb-3">
                               <s.icon size={16} className={s.color} />
                               <span className={`text-xs font-black uppercase tracking-tight italic ${s.color}`}>{s.label}</span>
                            </div>
                            <div className={`text-7xl font-display font-black tracking-tighter ${s.color}`}>{s.count}</div>
                         </div>
                       ))}
                    </div>

                    <div className="bg-white rounded-[40px] shadow-xl p-8 border border-slate-100">
                       <div className="grid grid-cols-3 gap-8 mb-8">
                          <div className="space-y-3">
                             <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                               <Search size={14} /> SEARCH
                             </label>
                             <input className="input-field border-slate-100" placeholder="Location or action..." />
                          </div>
                          <div className="space-y-3">
                             <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                               <Activity size={14} /> STATUS
                             </label>
                             <select className="input-field border-slate-100">
                                <option>All Statuses</option>
                             </select>
                          </div>
                          <div className="space-y-3">
                             <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                               <HistoryIcon size={14} /> DATE
                             </label>
                             <input type="date" className="input-field border-slate-100" />
                          </div>
                       </div>

                       <div className="flex gap-4">
                          <button onClick={() => setCurrentPage('dashboard')} className="flex-1 h-14 bg-slate-500 text-white rounded-2xl font-black text-sm uppercase italic tracking-wider flex items-center justify-center gap-2 hover:bg-slate-600 transition-all">
                             <Activity size={18} /> Return to Dashboard
                          </button>
                          <button onClick={handleExportCSV} className="flex-1 h-14 bg-green-500 text-white rounded-2xl font-black text-sm uppercase italic tracking-wider flex items-center justify-center gap-2 hover:bg-green-600 transition-all shadow-lg shadow-green-100">
                             <Download size={18} /> Export to CSV
                          </button>
                       </div>

                       {loggedInUser.role === 'Admin' && (
                         <div className="mt-12 space-y-4 pt-12 border-t-2 border-slate-50 border-dashed">
                            <p className="text-[11px] font-black text-red-500 uppercase tracking-tighter italic flex items-center gap-2">
                               <Info size={14} /> ADMIN ACTION — CANNOT BE UNDONE
                            </p>
                            <button onClick={handleDeleteHistory} className="w-full h-16 border-4 border-red-500 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white rounded-3xl font-black text-lg transition-all flex items-center justify-center gap-3">
                               <Trash2 size={24} /> Delete All History
                            </button>
                         </div>
                       )}
                    </div>

                    <div className="bg-white rounded-[48px] shadow-xl overflow-hidden border border-slate-100">
                       <table className="w-full text-left">
                          <thead>
                             <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Detected</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Location</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Status</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Acknowledged</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Resolved</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Response</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest italic">By</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                             {[
                               { time: '08:40:02 AM', date: 'Apr 22, 2026', loc: '4th Floor Female CR', status: 'Detected', color: 'bg-red-100 text-red-500', resolved: false },
                               { time: '08:38:55 AM', date: 'Apr 22, 2026', loc: '4th Floor Female CR', status: 'Cleared', color: 'bg-green-100 text-green-500', resolved: true, rTime: '42s', resAt: '08:39:43 AM', who: 'EJ Perez' },
                               { time: '08:38:40 AM', date: 'Apr 22, 2026', loc: '4th Floor Female CR', status: 'Cleared', color: 'bg-green-100 text-green-500', resolved: true, rTime: '11s', resAt: '08:38:51 AM', who: 'Staff Name' },
                             ].map((row, i) => (
                               <tr key={i} className="hover:bg-slate-50/50 transition-all font-bold">
                                  <td className="px-10 py-8 leading-tight">
                                     <div className="text-slate-400 text-xs tracking-tighter italic">{row.date},</div>
                                     <div className="text-slate-700 mt-0.5 tracking-tightest">{row.time}</div>
                                  </td>
                                  <td className="px-8 py-8">
                                     <div className="text-slate-800 tracking-tightest leading-snug">4th Floor<br />{row.loc.split('Floor ')[1]}</div>
                                  </td>
                                  <td className="px-8 py-8">
                                     <span className={`${row.color} px-4 py-1.5 rounded-full text-[10px] font-black italic uppercase tracking-tighter`}>{row.status}</span>
                                  </td>
                                  <td className="px-8 py-8 text-slate-300">—</td>
                                  <td className="px-8 py-8 text-slate-300">—</td>
                                  <td className="px-8 py-8">
                                     {row.resolved ? (
                                       <div className="leading-tight">
                                          <div className="text-brand-blue text-sm font-black italic">{row.rTime}</div>
                                          <div className="text-slate-300 text-[10px] mt-0.5">{row.date},<br />{row.resAt}</div>
                                       </div>
                                     ) : (
                                       <span className="text-slate-300">—</span>
                                     )}
                                  </td>
                                  <td className="px-8 py-8 text-slate-500 text-sm italic">{row.who || '—'}</td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>
              )}

              {currentPage === 'profile' && (
                <div className="max-w-2xl mx-auto py-12 animate-in slide-in-from-bottom duration-500">
                  <div className="bg-white rounded-[48px] shadow-2xl p-12 border border-slate-100 space-y-12">
                     <div className="text-center space-y-4">
                        <div className="relative inline-block group">
                           <div className="w-48 h-48 rounded-full bg-slate-100 p-2 border-8 border-slate-50 overflow-hidden shadow-inner">
                              {loggedInUser.photo_url ? (
                                 <img src={loggedInUser.photo_url} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                 <User size={80} className="w-full h-full p-12 text-slate-300" />
                              )}
                           </div>
                           <button className="absolute bottom-2 right-2 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-500 border border-slate-100 hover:text-brand-blue transition-all active:scale-90">
                              <Camera size={20} />
                           </button>
                        </div>
                        <div className="space-y-1">
                           <button className="flex items-center gap-1 text-[11px] font-black text-slate-400 border border-slate-100 px-4 py-1.5 rounded-full mx-auto uppercase tracking-tighter hover:bg-slate-50 transition-all">
                              <Camera size={12} /> Change Photo
                           </button>
                           <h1 className="text-5xl font-display font-bold text-dark-blue tracking-tighter mt-4 italic">{loggedInUser.full_name}</h1>
                        </div>
                     </div>

                     <div className="space-y-6 pt-12 border-t-4 border-slate-50 border-dotted">
                        {[
                          { label: 'Position', val: loggedInUser.position },
                          { label: 'Contact', val: '—' },
                          { label: 'Email', val: loggedInUser.email, color: 'text-brand-blue' },
                          { label: 'Employee ID', val: loggedInUser.employee_id },
                          { label: 'Date Joined', val: 'April 5, 2026' },
                          { label: 'Last Login', val: 'Apr 22, 2026, 08:54 AM' },
                          { label: 'Emergency Contact', val: '—' },
                        ].map(f => (
                           <div key={f.label} className="flex justify-between items-center group">
                              <span className="text-xs font-black text-dark-blue uppercase tracking-tighter opacity-100 italic">{f.label}:</span>
                              <span className={`text-base font-bold italic tracking-tightest ${f.color || 'text-slate-500'}`}>{f.val}</span>
                           </div>
                        ))}
                     </div>

                     <div className="flex gap-4 pt-12">
                        <div className="flex-1 bg-slate-100 text-slate-500 rounded-2xl h-14 flex items-center justify-center font-black text-xs uppercase tracking-tight italic">
                           Full Administrative Access
                        </div>
                        <button className="flex-1 bg-dark-blue text-white rounded-2xl h-14 font-black flex items-center justify-center gap-2 shadow-lg shadow-dark-blue/20 hover:opacity-90 active:scale-95 transition-all italic text-lg uppercase">
                           <Activity size={18} /> Edit Profile
                        </button>
                     </div>

                     <div className="pt-24 space-y-8 border-t-2 border-slate-50 border-dashed">
                        <h3 className="text-xl font-black text-dark-blue tracking-tighter flex items-center gap-3 italic">
                           <Shield size={24} className="text-brand-blue" /> Change Password
                        </h3>
                        <div className="space-y-6">
                           <div>
                              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Current Password</label>
                              <input type="password" placeholder="••••••••••••••••••••••••" className="input-field" />
                           </div>
                           <div>
                              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">New Password</label>
                              <input type="password" placeholder="Min. 8 characters" className="input-field" />
                           </div>
                           <button className="btn-primary h-14 uppercase font-black italic bg-dark-blue flex items-center justify-center">Update Password</button>
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {currentPage === 'contact' && (
                 <div className="max-w-3xl mx-auto space-y-12 animate-in slide-in-from-bottom duration-500 pb-24 italic">
                    <div className="text-center space-y-4">
                       <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-3 text-6xl font-display font-bold text-dark-blue tracking-tighter">
                             <Mail size={54} className="text-brand-cyan" /> Contact & Reports
                          </div>
                          <p className="text-lg text-slate-400 font-bold uppercase tracking-tight">Send feedback, report device issues, or submit suggestions to the administrator.</p>
                       </div>
                    </div>

                    <div className="bg-white rounded-[48px] shadow-2xl p-12 border border-slate-100 space-y-12">
                       <div className="flex items-center gap-4 text-3xl font-display font-bold text-dark-blue tracking-tighter">
                          <HistoryIcon size={32} className="text-dark-blue" /> Send a Report
                       </div>
                       <p className="text-lg text-slate-400 font-bold uppercase tracking-tight -mt-8">Have feedback or a device issue? Let us know.</p>
                       
                       <form onSubmit={handleTicketSubmit} className="space-y-8">
                          <div className="space-y-6">
                             <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Full Name</label>
                                <input className="input-field py-4" defaultValue={loggedInUser.full_name} disabled />
                             </div>
                             <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email Address</label>
                                <input className="input-field py-4" defaultValue={loggedInUser.email} disabled />
                             </div>
                             <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Subject</label>
                                <select name="subject" className="input-field py-4" required>
                                   <option value="">Select a subject</option>
                                   <option>Smoke Alert Feedback</option>
                                   <option>Device Maintenance</option>
                                   <option>General Suggestion</option>
                                   <option>Bug Report</option>
                                   <option>Other</option>
                                </select>
                             </div>
                             <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1 flex justify-between">
                                 MESSAGE <span>0/2000</span>
                                </label>
                                <textarea name="message" className="input-field min-h-[200px] py-4 resize-none" placeholder="Describe the issue or suggestion..." required></textarea>
                             </div>
                          </div>
                          <button type="submit" className="btn-primary h-16 flex items-center justify-center gap-3 text-lg uppercase font-black italic bg-dark-blue shadow-lg shadow-dark-blue/20 tracking-tighter">
                             <Bell size={24} /> Submit Report
                          </button>
                       </form>
                    </div>

                    <div className="bg-white rounded-[48px] shadow-xl p-12 border border-slate-100">
                       <h3 className="text-3xl font-display font-bold text-dark-blue tracking-tighter mb-8 italic flex items-center gap-4">
                          <Activity size={32} /> Admin Inbox
                       </h3>
                       <div className="space-y-1">
                          {[
                            { date: 'Apr 16, 04:54 PM', name: 'Earl Jims Pirez', ref: 'TK-642322' },
                            { date: 'Apr 08, 01:27 PM', name: 'Earl Pirez', ref: 'TK-832788' },
                          ].map((t, i) => (
                             <div key={i} className="flex justify-between items-center py-6 px-4 hover:bg-slate-50 transition-all rounded-3xl group border border-transparent hover:border-slate-100">
                                <div className="flex flex-col gap-1">
                                   <span className="text-slate-400 text-[11px] font-black uppercase tracking-tighter leading-none italic">{t.date} · {t.name} · <span className="text-brand-cyan">{t.ref}</span></span>
                                </div>
                                <div className="text-slate-700 font-bold group-hover:text-dark-blue transition-all italic text-sm">
                                   Smoke Alert Feedback
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
              )}
            </div>
            
            <footer className="mt-auto py-12 px-8 flex justify-center sticky bottom-0">
               <p className="text-[11px] text-slate-300 font-bold tracking-widest uppercase italic bg-white/40 backdrop-blur px-8 py-3 rounded-full border border-slate-200 shadow-sm">
                  Campus Vape Aerosol Detection System v2.0
               </p>
            </footer>
          </div>
        )}
      </main>
      
      {/* Sound Overlay Context Button */}
      {loggedInUser && (
        <button className="fixed bottom-6 left-6 z-40 bg-white/20 hover:bg-white/40 px-5 py-3 rounded-2xl backdrop-blur border border-white/20 text-white font-bold text-[10px] uppercase tracking-widest transition-all">
          <Info size={14} className="inline mr-2" /> Press ? for shortcuts
        </button>
      )}

      {currentPage === 'dashboard' && (
        <button className="fixed bottom-6 right-8 z-40 bg-dark-blue text-white w-14 h-14 rounded-3xl flex items-center justify-center shadow-2xl shadow-dark-blue/40 border border-white/10 hover:translate-y-[-4px] active:scale-90 transition-all">
          <ChevronUp size={30} />
        </button>
      )}
    </div>
  );
}
