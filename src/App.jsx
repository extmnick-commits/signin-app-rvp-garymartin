import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, query, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { User, Mail, Phone, ClipboardCheck, Printer, ChevronLeft, Lock, CheckCircle2, ArrowRight, RefreshCw, Folder, Briefcase, Settings, Plus, ImageIcon, X, Trash2, Smartphone, Save, Search, Download, Calendar, ShieldCheck, Eraser, Activity, Grid } from 'lucide-react';

// --- FIREBASE CONFIG ---
// --- FIREBASE CONFIG (Connected to .env) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const defaultSession = { 
  title: 'Welcome!', 
  subtitle: 'Please sign in for today\'s session.', 
  logo: '', 
  logoHeight: 80,
  logo2: '',
  logoHeight2: 80,
  reqEmail: true,
  reqPhone: true,
  allowAgent: true,
  reqSecuritiesLicense: false,
  reqRvpUpline: false,
  guestTabLabel: "I'm a Guest",
  agentTabLabel: "I'm an Agent"
};

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('SIGNIN'); 
  const [adminTab, setAdminTab] = useState('BUILDER'); 
  const [builderSubTab, setBuilderSubTab] = useState('GUEST'); 
  const [adminPin, setAdminPin] = useState('');
  
  // Data States
  const [submissions, setSubmissions] = useState([]);
  const [presets, setPresets] = useState([]);
  const [logoLibrary, setLogoLibrary] = useState([]);
  const [pickingLogoTarget, setPickingLogoTarget] = useState(null); 
  
  // Session States
  const [liveSession, setLiveSession] = useState(defaultSession);
  const [builderSession, setBuilderSession] = useState(defaultSession);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  // Form & Filter States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [autoSignTriggered, setAutoSignTriggered] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const [isEditingAgent, setIsEditingAgent] = useState(false); 
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', repId: '', invitedBy: '', securitiesLicense: false, rvpUpline: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  const fileInputRef1 = useRef(null);
  const fileInputRef2 = useRef(null);

  // 1. Auth Init
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'artifacts', 'virtual-sign-sheet', 'config', 'currentSession'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const fullData = {
          title: data.title || 'Welcome!',
          subtitle: data.subtitle || '',
          logo: data.logo || '',
          logoHeight: data.logoHeight || 80,
          logo2: data.logo2 || '',
          logoHeight2: data.logoHeight2 || 80,
          reqEmail: data.reqEmail !== false,
          reqPhone: data.reqPhone !== false,
          allowAgent: data.allowAgent !== false,
          reqSecuritiesLicense: data.reqSecuritiesLicense || false,
          reqRvpUpline: data.reqRvpUpline || false,
          guestTabLabel: data.guestTabLabel || "I'm a Guest",
          agentTabLabel: data.agentTabLabel || "I'm an Agent"
        };
        setLiveSession(fullData);
        if (!hasUnpublishedChanges) setBuilderSession(fullData); 
      }
      setIsSessionLoaded(true);
    });

    const qSignins = query(collection(db, 'artifacts', 'virtual-sign-sheet', 'public', 'data', 'signins'), orderBy('timestamp', 'desc'));
    const unsubSignins = onSnapshot(qSignins, (snap) => setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubPresets = onSnapshot(collection(db, 'artifacts', 'virtual-sign-sheet', 'presets'), (snap) => {
      setPresets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    fetchLogoLibrary();
    return () => { unsubSignins(); unsubSettings(); unsubPresets(); };
  }, []);

  // 3. Auto-Submit Feature for Returning Agents
  useEffect(() => {
    if (view === 'SIGNIN' && isSessionLoaded && !autoSignTriggered) {
      const savedAgent = localStorage.getItem('saved_agent_info');
      if (savedAgent) {
        setAutoSignTriggered(true);
        const parsed = JSON.parse(savedAgent);
        setFormData(parsed);
        setIsAgent(true);
        setRememberMe(true);
        performBackgroundSubmit(parsed);
      }
    }
  }, [view, isSessionLoaded]);

  const performBackgroundSubmit = async (parsedData) => {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', 'virtual-sign-sheet', 'public', 'data', 'signins'), {
        name: parsedData.name,
        email: (liveSession.reqEmail && parsedData.email) ? parsedData.email : 'N/A',
        phone: liveSession.reqPhone ? parsedData.phone : 'N/A',
        sessionTitle: liveSession.title,
        role: 'Agent',
        repId: parsedData.repId || 'N/A',
        rvpUpline: parsedData.rvpUpline || 'N/A',
        securitiesLicense: parsedData.securitiesLicense ? 'Yes' : 'No',
        invitedBy: 'N/A',
        timestamp: serverTimestamp(),
        dateString: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      setShowSuccess(true);
    } catch (e) {
      console.error("Auto sign in failed", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchLogoLibrary = async () => {
    try {
      const listRef = ref(storage, 'logos');
      const res = await listAll(listRef);
      const items = await Promise.all(res.items.map(async (itemRef) => ({
        name: itemRef.name,
        url: await getDownloadURL(itemRef),
        ref: itemRef
      })));
      setLogoLibrary(items);
    } catch (error) { console.error("Error fetching logos"); }
  };

  // --- DERIVED DATA & ROSTER STATS ---
  const { uniqueDates, displayedSubmissions, rosterStats } = useMemo(() => {
    const dates = [...new Set(submissions.map(s => s.dateString))].filter(Boolean);
    let filtered = submissions;
    if (selectedFolder !== 'All') {
      filtered = filtered.filter(s => s.dateString === selectedFolder);
    }
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    const stats = {
      total: filtered.length,
      agents: filtered.filter(s => s.role === 'Agent').length,
      guests: filtered.filter(s => s.role === 'Guest').length
    };
    
    return { uniqueDates: dates, displayedSubmissions: filtered, rosterStats: stats };
  }, [submissions, selectedFolder, searchTerm]);

  // --- ACTIONS ---
  const handleGuestSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isAgent && rememberMe) {
        localStorage.setItem('saved_agent_info', JSON.stringify(formData));
        setIsEditingAgent(false); 
      } else if (isAgent && !rememberMe) {
        localStorage.removeItem('saved_agent_info');
      }

      await addDoc(collection(db, 'artifacts', 'virtual-sign-sheet', 'public', 'data', 'signins'), {
        name: formData.name,
        email: (liveSession.reqEmail && formData.email) ? formData.email : 'N/A',
        phone: liveSession.reqPhone ? formData.phone : 'N/A',
        sessionTitle: liveSession.title,
        role: (liveSession.allowAgent && isAgent) ? 'Agent' : 'Guest',
        repId: (liveSession.allowAgent && isAgent) ? formData.repId : 'N/A',
        rvpUpline: (liveSession.reqRvpUpline && isAgent && formData.rvpUpline) ? formData.rvpUpline : 'N/A',
        securitiesLicense: (liveSession.reqSecuritiesLicense && isAgent) ? (formData.securitiesLicense ? 'Yes' : 'No') : 'N/A',
        invitedBy: (!isAgent && formData.invitedBy) ? formData.invitedBy : 'N/A',
        timestamp: serverTimestamp(),
        dateString: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      
      if (!isAgent || (isAgent && !rememberMe)) {
        setFormData({ name: '', email: '', phone: '', repId: '', invitedBy: '', securitiesLicense: false, rvpUpline: '' });
        setIsAgent(false);
      }
      
      setShowSuccess(true);
    } catch (err) { alert("Submission failed."); } 
    finally { setIsSubmitting(false); }
  };

  const clearAndReturn = () => {
    setShowSuccess(false);
    setAutoSignTriggered(false);
    localStorage.removeItem('saved_agent_info');
    setFormData({ name: '', email: '', phone: '', repId: '', invitedBy: '', securitiesLicense: false, rvpUpline: '' });
    setIsAgent(false);
    setRememberMe(false);
  };

  const cleanDuplicates = async () => {
    const seen = new Set();
    const toDelete = [];
    
    displayedSubmissions.forEach(sub => {
      const key = `${sub.name?.toLowerCase()}-${sub.role}-${sub.dateString}`;
      if (seen.has(key)) {
        toDelete.push(sub.id);
      } else {
        seen.add(key);
      }
    });

    if (toDelete.length > 0) {
      if (window.confirm(`Found ${toDelete.length} exact duplicate sign-in(s). Would you like to clean them up?`)) {
        try {
          toDelete.forEach(async (id) => {
            await deleteDoc(doc(db, 'artifacts', 'virtual-sign-sheet', 'public', 'data', 'signins', id));
          });
          alert("Duplicates removed successfully!");
        } catch(e) { alert("Failed to delete duplicates."); }
      }
    } else {
      alert("No duplicates found in this folder!");
    }
  };

  const deleteLogo = async (logoItem) => {
    if (window.confirm("Delete this logo from the cloud library?")) {
      try {
        await deleteObject(logoItem.ref);
        if (builderSession.logo === logoItem.url) updateBuilder({ logo: '' });
        if (builderSession.logo2 === logoItem.url) updateBuilder({ logo2: '' });
        fetchLogoLibrary();
      } catch (err) { alert("Delete failed."); }
    }
  };

  const downloadCSV = () => {
    const headers = ["Name", "Email", "Phone", "Role", "RepID", "RVP Upline", "Securities License", "Invited By", "Date", "Time"];
    const rows = displayedSubmissions.map(s => [s.name, s.email, s.phone, s.role, s.repId, s.rvpUpline || 'N/A', s.securitiesLicense || 'N/A', s.invitedBy || 'N/A', s.dateString, s.timeString]);
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `"${liveSession.title}","${liveSession.subtitle}"\n\n`;
    csvContent += [headers, ...rows].map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Roster_${selectedFolder}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPin === '2501') { setView('ADMIN_DASHBOARD'); setAdminPin(''); } 
    else { alert("Incorrect PIN"); setAdminPin(''); }
  };

  const updateBuilder = (newData) => {
    setBuilderSession(prev => ({ ...prev, ...newData }));
    setHasUnpublishedChanges(true);
  };

  const publishChanges = async () => {
    try {
      await setDoc(doc(db, 'artifacts', 'virtual-sign-sheet', 'config', 'currentSession'), builderSession, { merge: true });
      setHasUnpublishedChanges(false);
      alert("Success! Published to Live.");
    } catch (e) { alert("Publish failed."); }
  };

  const savePreset = async () => {
    const name = prompt("Name this preset layout:");
    if (name) {
      await addDoc(collection(db, 'artifacts', 'virtual-sign-sheet', 'presets'), { ...builderSession, presetName: name });
    }
  };

  const loadPreset = (p) => {
    updateBuilder({
      title: p.title || '', subtitle: p.subtitle || '', logo: p.logo || '', logoHeight: p.logoHeight || 80, logo2: p.logo2 || '', logoHeight2: p.logoHeight2 || 80,
      reqEmail: p.reqEmail !== false, reqPhone: p.reqPhone !== false, allowAgent: p.allowAgent !== false, reqSecuritiesLicense: p.reqSecuritiesLicense || false, reqRvpUpline: p.reqRvpUpline || false,
      guestTabLabel: p.guestTabLabel || "I'm a Guest", agentTabLabel: p.agentTabLabel || "I'm an Agent"
    });
  };

  const handleLogoUpload = async (e, targetLogo) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updateBuilder({ [targetLogo]: url });
      fetchLogoLibrary();
    } catch (err) { alert("Upload failed."); }
  };

  const deleteItem = async (path, id) => {
    if (window.confirm("Permanently delete?")) {
      await deleteDoc(doc(db, 'artifacts', 'virtual-sign-sheet', path, id));
    }
  };

  // --- RENDER FORM ---
  const renderSignInForm = (isPreview = false) => {
    const s = isPreview ? builderSession : liveSession;
    
    return (
      <div className={`modern-card ${isPreview ? 'preview-mode' : ''}`} style={isPreview ? { transform: 'scale(0.85)', transformOrigin: 'top center', margin: '0 auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '8px solid #0f172a' } : {}}>
        <header style={{marginBottom: '1.5rem', textAlign: 'center'}}>
          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap'}}>
            {s.logo && <img src={s.logo} alt="Primary Logo" style={{height: `${s.logoHeight}px`, objectFit: 'contain'}} />}
            {s.logo2 && <img src={s.logo2} alt="Secondary Logo" style={{height: `${s.logoHeight2}px`, objectFit: 'contain'}} />}
          </div>
          <h1 style={{fontSize: '2.2rem', margin: 0}}>{s.title}</h1>
          <p style={{marginTop: '0.5rem', color: '#64748b'}}>{s.subtitle}</p>
        </header>

        {showSuccess && !isPreview ? (
          <div style={{textAlign: 'center', padding: '2rem'}}>
            <CheckCircle2 size={64} color="#22c55e" style={{margin: '0 auto 1rem'}} />
            <h2 style={{color: '#0f172a'}}>Sign-in Verified</h2>
            <p style={{color: '#64748b', marginBottom: '2rem'}}>Thank you, {formData.name}!</p>
            <button onClick={() => { setShowSuccess(false); if(!rememberMe){ setFormData({ name: '', email: '', phone: '', repId: '', invitedBy: '', securitiesLicense: false, rvpUpline: '' }); setIsAgent(false); } }} className="primary-button" style={{marginBottom: '1rem'}}>Done</button>
            {autoSignTriggered && (
              <button type="button" onClick={clearAndReturn} style={{background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline'}}>Not {formData.name}? Click Here.</button>
            )}
          </div>
        ) : (
          <form onSubmit={isPreview ? (e)=>e.preventDefault() : handleGuestSubmit} className="signin-form">
            
            {/* Top Guest / Agent Toggle */}
            {s.allowAgent && !autoSignTriggered && (
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.5rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <button type="button" onClick={() => setIsAgent(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: !isAgent ? 'white' : 'transparent', color: !isAgent ? '#0f172a' : '#64748b', fontWeight: 'bold', boxShadow: !isAgent ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: '0.2s', cursor: 'pointer' }}>{s.guestTabLabel}</button>
                <button type="button" onClick={() => setIsAgent(true)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: isAgent ? 'white' : 'transparent', color: isAgent ? '#0f172a' : '#64748b', fontWeight: 'bold', boxShadow: isAgent ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: '0.2s', cursor: 'pointer' }}>{s.agentTabLabel}</button>
              </div>
            )}

            <>
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <div className="input-wrapper"><User size={18} className="input-icon" /><input className="modern-input" required placeholder="Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} disabled={isPreview}/></div>
              </div>

              {/* Only show "Who invited you?" if it's a Guest */}
              {!isAgent && (
                <div className="input-group" style={{ animation: 'fadeIn 0.3s' }}>
                  <label className="input-label">Who invited you?</label>
                  <div className="input-wrapper"><User size={18} className="input-icon" /><input className="modern-input" placeholder="Name of person" value={formData.invitedBy} onChange={(e) => setFormData({...formData, invitedBy: e.target.value})} disabled={isPreview}/></div>
                </div>
              )}

              {s.reqEmail && (
                <div className="input-group">
                  <label className="input-label">Email Address (Optional)</label>
                  <div className="input-wrapper"><Mail size={18} className="input-icon" /><input className="modern-input" type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} disabled={isPreview}/></div>
                </div>
              )}

              {s.reqPhone && (
                <div className="input-group">
                  <label className="input-label">Phone Number</label>
                  <div className="input-wrapper"><Phone size={18} className="input-icon" /><input className="modern-input" type="tel" required placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} disabled={isPreview}/></div>
                </div>
              )}

              {/* Agent Specific Fields */}
              {s.allowAgent && isAgent && (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                  
                  {s.reqRvpUpline && (
                    <div className="input-group" style={{ animation: 'fadeIn 0.3s' }}>
                      <label className="input-label">RVP Upline</label>
                      <div className="input-wrapper"><User size={18} className="input-icon" /><input className="modern-input" required placeholder="RVP Name" value={formData.rvpUpline} onChange={(e) => setFormData({...formData, rvpUpline: e.target.value})} disabled={isPreview}/></div>
                    </div>
                  )}

                  <div className="input-group">
                    <label className="input-label">REP ID</label>
                    <div className="input-wrapper"><Briefcase size={18} className="input-icon" /><input className="modern-input" required placeholder="Ex: ABC12" value={formData.repId} onChange={(e) => setFormData({...formData, repId: e.target.value})} disabled={isPreview}/></div>
                  </div>

                  {s.reqSecuritiesLicense && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', background: '#eff6ff', padding: '1rem', borderRadius: '12px', border: '1px solid #dbeafe', animation: 'fadeIn 0.3s' }}>
                      <input type="checkbox" id="sec-license" checked={formData.securitiesLicense} onChange={(e) => setFormData({...formData, securitiesLicense: e.target.checked})} style={{ width: '1.2rem', height: '1.2rem' }} disabled={isPreview} />
                      <label htmlFor="sec-license" style={{ fontWeight: 'bold', color: '#1e40af', cursor: 'pointer' }}>I hold a Securities License</label>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <input type="checkbox" id="remember-me" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: '1.2rem', height: '1.2rem' }} disabled={isPreview} />
                    <label htmlFor="remember-me" style={{ fontWeight: 'bold', color: '#0f172a', cursor: 'pointer' }}>Remember my info on this device</label>
                  </div>
                </div>
              )}

              <button disabled={isSubmitting || isPreview} type="submit" className="primary-button" style={{marginTop: '1rem'}}>{isSubmitting ? "Processing..." : "Sign In"} <ArrowRight size={20} /></button>
            </>
          </form>
        )}
      </div>
    );
  };

  return (
    <div className="app-shell">
      {/* Cloud Logo Library Picker Overlay */}
      {pickingLogoTarget && (
        <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'}}>
          <div style={{background: 'white', padding: '2rem', borderRadius: '1.5rem', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflow: 'auto'}}>
             <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                <h3 style={{margin: 0}}>Pick from Cloud Gallery</h3>
                <button onClick={() => setPickingLogoTarget(null)} style={{background: 'none', border: 'none', cursor: 'pointer', color: '#64748b'}}><X size={24}/></button>
             </div>
             <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem'}}>
                {logoLibrary.map((item, i) => (
                   <div key={i} onClick={() => { updateBuilder({ [pickingLogoTarget]: item.url }); setPickingLogoTarget(null); }} style={{border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '12px', cursor: 'pointer', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', transition: '0.2s'}}>
                      <img src={item.url} style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}} />
                   </div>
                ))}
                {logoLibrary.length === 0 && <p style={{color: '#94a3b8', gridColumn: '1/-1'}}>No logos uploaded to the cloud yet.</p>}
             </div>
          </div>
        </div>
      )}

      <nav className="navbar print:hidden">
        <div className="logo-section" onClick={() => setView('SIGNIN')} style={{cursor: 'pointer'}}>
          <div style={{background: '#4f46e5', padding: '8px', borderRadius: '12px'}}><ClipboardCheck size={20} color="white" /></div>
          <span className="logo-text">VirtualSign</span>
        </div>
        <button onClick={() => setView(view === 'SIGNIN' ? 'ADMIN_LOGIN' : 'SIGNIN')} className="admin-toggle">
          {view === 'SIGNIN' ? <><Lock size={14} /> Admin</> : <><ChevronLeft size={14} /> Back</>}
        </button>
      </nav>

      <main className="main-container">
        {view === 'SIGNIN' && renderSignInForm(false)}

        {view === 'ADMIN_LOGIN' && (
          <div className="modern-card login-card" style={{maxWidth: '400px', margin: '5rem auto'}}>
             <Lock size={48} color="#4f46e5" style={{margin: '0 auto 1rem'}} />
             <h2>Admin Access</h2>
             <form onSubmit={handleAdminLogin}>
                <input type="password" className="modern-input" placeholder="0000" maxLength={4} style={{textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em', marginBottom: '1.5rem'}} value={adminPin} onChange={(e) => setAdminPin(e.target.value)} />
                <button type="submit" className="primary-button">Unlock Dashboard</button>
             </form>
          </div>
        )}

        {view === 'ADMIN_DASHBOARD' && (
          <div className="admin-dashboard">
            <div className="admin-tabs print:hidden" style={{display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem'}}>
               <button onClick={() => setAdminTab('BUILDER')} className={`tab-btn ${adminTab === 'BUILDER' ? 'active' : ''}`}><Settings size={18}/> Page Builder</button>
               <button onClick={() => setAdminTab('ROSTER')} className={`tab-btn ${adminTab === 'ROSTER' ? 'active' : ''}`}><Folder size={18}/> Data Roster</button>
               <button onClick={() => setAdminTab('LOGOS')} className={`tab-btn ${adminTab === 'LOGOS' ? 'active' : ''}`}><ImageIcon size={18}/> Logo Gallery</button>
            </div>

            {adminTab === 'BUILDER' && (
               <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '3rem', alignItems: 'start'}}>
                 <div style={{ background: 'white', padding: '2rem', borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem'}}>
                      <h2 style={{margin:0}}>Configure Page</h2>
                      <button onClick={publishChanges} className="primary-button" style={{width:'auto', padding:'0.5rem 1rem', background: hasUnpublishedChanges ? '#22c55e' : '#94a3b8'}}><Save size={16}/> {hasUnpublishedChanges ? "Publish Changes" : "Up to Date"}</button>
                    </div>

                    <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                      <div><label className="input-label">Title</label><input className="modern-input" value={builderSession.title} onChange={(e) => updateBuilder({ title: e.target.value })} /></div>
                      <div><label className="input-label">Subtitle</label><input className="modern-input" value={builderSession.subtitle} onChange={(e) => updateBuilder({ subtitle: e.target.value })} /></div>
                      
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px' }}>
                        <label className="input-label">Visibility Options</label>
                        
                        <div style={{display:'flex', gap:'0.5rem', borderBottom:'1px solid #e2e8f0', marginBottom:'1rem', paddingBottom:'0.5rem', marginTop: '0.5rem'}}>
                           <button onClick={() => setBuilderSubTab('GUEST')} style={{background:'none', border:'none', fontWeight:'bold', color: builderSubTab === 'GUEST' ? '#4f46e5' : '#94a3b8', cursor:'pointer'}}>Guest Tab</button>
                           <button onClick={() => setBuilderSubTab('AGENT')} style={{background:'none', border:'none', fontWeight:'bold', color: builderSubTab === 'AGENT' ? '#4f46e5' : '#94a3b8', cursor:'pointer'}}>Agent Tab</button>
                        </div>

                        {builderSubTab === 'GUEST' ? (
                           <div className="fade-in">
                              <label style={{fontSize: '0.8rem', color: '#64748b'}}>Guest Button Text</label>
                              <input className="modern-input" style={{marginBottom:'1rem', padding:'0.5rem'}} value={builderSession.guestTabLabel} onChange={(e) => updateBuilder({ guestTabLabel: e.target.value })} />
                              <label style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', fontWeight:'bold'}}><input type="checkbox" checked={builderSession.reqEmail} onChange={(e)=>updateBuilder({reqEmail: e.target.checked})}/> Show Email Field</label>
                              <label style={{display:'flex', gap:'0.5rem', fontWeight:'bold'}}><input type="checkbox" checked={builderSession.reqPhone} onChange={(e)=>updateBuilder({reqPhone: e.target.checked})}/> Show Phone Field</label>
                           </div>
                        ) : (
                           <div className="fade-in">
                              <label style={{fontSize: '0.8rem', color: '#64748b'}}>Agent Button Text</label>
                              <input className="modern-input" style={{marginBottom:'1rem', padding:'0.5rem'}} value={builderSession.agentTabLabel} onChange={(e) => updateBuilder({ agentTabLabel: e.target.value })} />
                              <label style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', fontWeight:'bold'}}><input type="checkbox" checked={builderSession.allowAgent} onChange={(e)=>updateBuilder({allowAgent: e.target.checked})}/> Enable Agent Login</label>
                              <label style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem', fontWeight:'bold'}}><input type="checkbox" checked={builderSession.reqRvpUpline} onChange={(e)=>updateBuilder({reqRvpUpline: e.target.checked})}/> Require RVP Upline Field</label>
                              <label style={{display:'flex', gap:'0.5rem', fontWeight:'bold'}}><input type="checkbox" checked={builderSession.reqSecuritiesLicense} onChange={(e)=>updateBuilder({reqSecuritiesLicense: e.target.checked})}/> Require Securities Checkbox</label>
                           </div>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label className="input-label">Primary Logo</label>
                          <div style={{display: 'flex', gap: '0.5rem', marginTop: '0.5rem'}}>
                            <button onClick={() => fileInputRef1.current.click()} className="admin-toggle" style={{padding: '0.4rem 0.8rem'}}><Plus size={14} /></button>
                            <button onClick={() => setPickingLogoTarget('logo')} className="admin-toggle" style={{padding: '0.4rem 0.8rem'}}><Grid size={14} /></button>
                            {builderSession.logo && <button onClick={() => updateBuilder({logo: ''})} className="admin-toggle" style={{color: '#ef4444', padding: '0.4rem 0.8rem'}}><X size={14}/></button>}
                            <input type="file" ref={fileInputRef1} hidden onChange={(e) => handleLogoUpload(e, 'logo')} accept="image/*" />
                          </div>
                          {builderSession.logo && (
                            <input type="range" min="40" max="250" value={builderSession.logoHeight} onChange={(e) => updateBuilder({ logoHeight: Number(e.target.value) })} style={{width: '100%', marginTop: '0.5rem'}} />
                          )}
                        </div>
                        <div>
                          <label className="input-label">Secondary Logo</label>
                          <div style={{display: 'flex', gap: '0.5rem', marginTop: '0.5rem'}}>
                            <button onClick={() => fileInputRef2.current.click()} className="admin-toggle" style={{padding: '0.4rem 0.8rem'}}><Plus size={14} /></button>
                            <button onClick={() => setPickingLogoTarget('logo2')} className="admin-toggle" style={{padding: '0.4rem 0.8rem'}}><Grid size={14} /></button>
                            {builderSession.logo2 && <button onClick={() => updateBuilder({logo2: ''})} className="admin-toggle" style={{color: '#ef4444', padding: '0.4rem 0.8rem'}}><X size={14}/></button>}
                            <input type="file" ref={fileInputRef2} hidden onChange={(e) => handleLogoUpload(e, 'logo2')} accept="image/*" />
                          </div>
                          {builderSession.logo2 && (
                            <input type="range" min="40" max="250" value={builderSession.logoHeight2} onChange={(e) => updateBuilder({ logoHeight2: Number(e.target.value) })} style={{width: '100%', marginTop: '0.5rem'}} />
                          )}
                        </div>
                      </div>

                      <div style={{borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
                          <label className="input-label">Cloud Presets</label>
                          <button onClick={savePreset} className="admin-toggle"><Plus size={14}/> Save Current</button>
                        </div>
                        <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                          {presets.map(p => (
                            <div key={p.id} style={{position: 'relative'}}>
                              <button onClick={() => loadPreset(p)} className="admin-toggle" style={{paddingRight:'2rem'}}>{p.presetName}</button>
                              <Trash2 size={12} onClick={() => deleteItem('presets', p.id)} style={{position:'absolute', right:'8px', top:'10px', color:'#ef4444', cursor:'pointer'}} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                 </div>
                 <div style={{position: 'sticky', top: '100px'}}><div style={{textAlign:'center', color:'#64748b', fontWeight:'bold', marginBottom:'1rem'}}><Smartphone size={18}/> Mobile Preview</div>{renderSignInForm(true)}</div>
               </div>
            )}

            {adminTab === 'ROSTER' && (
              <div className="fade-in">
                <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                   <div>
                     <h1 style={{margin: 0}}>Data Roster</h1>
                     <p style={{color: '#64748b', margin: '0.2rem 0 0 0'}}>Viewing: {selectedFolder === 'All' ? 'Complete History' : selectedFolder}</p>
                   </div>
                   <div style={{display: 'flex', gap: '1rem'}}>
                     <div className="input-wrapper" style={{width: '250px'}}>
                        <Search size={18} className="input-icon" />
                        <input className="modern-input" placeholder="Search names or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                     </div>
                     <button onClick={cleanDuplicates} className="admin-toggle" style={{color: '#f59e0b'}}><Eraser size={18} /> Clean Duplicates</button>
                     <button onClick={downloadCSV} className="admin-toggle"><Download size={18} /> Export CSV</button>
                     <button onClick={() => window.print()} className="primary-button" style={{width: 'auto'}}><Printer size={18} /> Print PDF</button>
                   </div>
                </header>

                {/* Dashboard Stats */}
                <div className="print:hidden" style={{display: 'flex', gap: '1.5rem', marginBottom: '2rem'}}>
                   <div style={{flex: 1, background: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem'}}>
                     <div style={{background: '#eff6ff', padding: '1rem', borderRadius: '50%', color: '#3b82f6'}}><Activity size={24}/></div>
                     <div><p style={{margin: 0, color: '#64748b', fontWeight: 'bold'}}>Total Sign-ins</p><h2 style={{margin: 0, fontSize: '2rem'}}>{rosterStats.total}</h2></div>
                   </div>
                   <div style={{flex: 1, background: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem'}}>
                     <div style={{background: '#fef2f2', padding: '1rem', borderRadius: '50%', color: '#ef4444'}}><Briefcase size={24}/></div>
                     <div><p style={{margin: 0, color: '#64748b', fontWeight: 'bold'}}>Total Agents</p><h2 style={{margin: 0, fontSize: '2rem'}}>{rosterStats.agents}</h2></div>
                   </div>
                   <div style={{flex: 1, background: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem'}}>
                     <div style={{background: '#f0fdf4', padding: '1rem', borderRadius: '50%', color: '#22c55e'}}><User size={24}/></div>
                     <div><p style={{margin: 0, color: '#64748b', fontWeight: 'bold'}}>Total Guests</p><h2 style={{margin: 0, fontSize: '2rem'}}>{rosterStats.guests}</h2></div>
                   </div>
                </div>

                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div className="print:hidden" style={{ width: '220px' }}>
                    <h3 style={{display:'flex', alignItems:'center', gap:'0.5rem'}}><Calendar size={18} /> Folders</h3>
                    <button onClick={() => setSelectedFolder('All')} style={{ width: '100%', textAlign: 'left', padding: '0.75rem', borderRadius: '8px', border: 'none', background: selectedFolder === 'All' ? '#eff6ff' : 'transparent', color: selectedFolder === 'All' ? '#4f46e5' : '#64748b', fontWeight: 'bold' }}>All Records</button>
                    {uniqueDates.map(date => (
                      <button key={date} onClick={() => setSelectedFolder(date)} style={{ width: '100%', textAlign: 'left', padding: '0.75rem', borderRadius: '8px', border: 'none', background: selectedFolder === date ? '#eff6ff' : 'transparent', color: selectedFolder === date ? '#4f46e5' : '#64748b', fontWeight: 'bold' }}>{date}</button>
                    ))}
                  </div>

                  <div style={{ flex: 1, background: 'white', borderRadius: '1.5rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    
                    {/* PDF Print Header (Hidden on screen) */}
                    <div className="print-only" style={{ padding: '2rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', marginBottom: '1.5rem' }}>
                        {liveSession.logo && <img src={liveSession.logo} style={{ height: `${liveSession.logoHeight}px`, objectFit: 'contain' }} />}
                        {liveSession.logo2 && <img src={liveSession.logo2} style={{ height: `${liveSession.logoHeight2}px`, objectFit: 'contain' }} />}
                      </div>
                      <h1 style={{ margin: 0, color: '#0f172a' }}>{liveSession.title}</h1>
                      <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '1.2rem' }}>{liveSession.subtitle}</p>
                      <p style={{ margin: '1rem 0 0 0', fontWeight: 'bold' }}>Date Log: {selectedFolder}</p>
                    </div>

                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                      <thead style={{background: '#f8fafc'}}><tr><th style={{padding: '1rem', textAlign:'left'}}>Name</th><th style={{padding: '1rem', textAlign:'left'}}>Contact</th><th style={{padding: '1rem', textAlign:'left'}}>Role Details</th><th style={{padding: '1rem', textAlign:'left'}}>Time</th><th className="print:hidden"></th></tr></thead>
                      <tbody>
                        {displayedSubmissions.length === 0 ? (
                          <tr><td colSpan="5" style={{padding: '3rem', textAlign: 'center', color: '#94a3b8'}}>No sign-ins found.</td></tr>
                        ) : (
                          displayedSubmissions.map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{padding: '1rem', fontWeight: 'bold'}}>{item.name}</td>
                              <td style={{padding: '1rem'}}>{item.email}<br/><small style={{color:'#64748b'}}>{item.phone}</small></td>
                              <td style={{padding: '1rem'}}>
                                <span style={{display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', background: item.role === 'Agent' ? '#fef2f2' : '#f0fdf4', color: item.role === 'Agent' ? '#ef4444' : '#22c55e', marginBottom: '0.3rem'}}>{item.role}</span>
                                {item.role === 'Agent' && <><br/><small style={{color:'#64748b', fontWeight: 'bold'}}>ID: {item.repId}</small></>}
                                {item.role === 'Agent' && item.rvpUpline && item.rvpUpline !== 'N/A' && <><br/><small style={{color:'#64748b'}}>RVP: {item.rvpUpline}</small></>}
                                {item.securitiesLicense && item.securitiesLicense !== 'N/A' && <><br/><small style={{color:'#64748b'}}>Sec. Lic: {item.securitiesLicense}</small></>}
                                {item.role === 'Guest' && item.invitedBy && item.invitedBy !== 'N/A' && <><br/><small style={{color:'#64748b'}}>Invited by: {item.invitedBy}</small></>}
                              </td>
                              <td style={{padding: '1rem', fontSize: '0.8rem', color: '#64748b'}}>{item.dateString}<br/>{item.timeString}</td>
                              <td className="print:hidden" style={{padding: '1rem', textAlign: 'right'}}><Trash2 size={16} color="#ef4444" style={{cursor: 'pointer'}} onClick={() => deleteItem('public/data/signins', item.id)} /></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {adminTab === 'LOGOS' && (
              <div className="fade-in" style={{ background: 'white', padding: '2rem', borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                <h2>Cloud Logo Library</h2>
                <p>Logos are synced in your cloud storage. Click to use, or use the trash icon to delete.</p>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem', marginTop: '2rem'}}>
                  {logoLibrary.map((item, i) => (
                    <div key={i} style={{position:'relative', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', background: '#f8fafc'}}>
                      <div onClick={() => {updateBuilder({logo: item.url}); setAdminTab('BUILDER');}} style={{height:'100px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <img src={item.url} style={{maxHeight: '100%', maxWidth: '100%', objectFit: 'contain'}} />
                      </div>
                      <button onClick={() => deleteLogo(item)} style={{position:'absolute', top:'8px', right:'8px', background:'white', border:'1px solid #fee2e2', color:'#ef4444', borderRadius:'50%', padding:'5px', cursor:'pointer'}}><Trash2 size={14}/></button>
                    </div>
                  ))}
                  {logoLibrary.length === 0 && <p style={{color:'#94a3b8'}}>Library is empty.</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        @media screen { .print-only { display: none !important; } }
        @media print { .print-only { display: block !important; } .print\:hidden { display: none !important; } }
        .tab-btn { background: none; border: none; padding: 0.5rem 1rem; font-size: 1rem; color: #64748b; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; border-bottom: 3px solid transparent; transition: 0.2s;}
        .tab-btn.active { color: #4f46e5; border-bottom-color: #4f46e5; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
};

export default App;