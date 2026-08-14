import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  Search, Bell, ChevronDown, Plus, Home, FolderOpen, Database, Network,
  Bookmark, Link2, FileText, Video, Sparkles, ArrowRight, MoreHorizontal,
  BrainCircuit, Leaf, Zap, Clock, Sun, Atom, Scale, Users, Trash2,
  LayoutGrid, List, Share2, ExternalLink, X, ZoomIn, ZoomOut, RotateCcw,
  LogOut, Settings, User, Mail, Lock, ArrowLeft, Check, MessageCircleQuestion,
  Quote, Maximize2, Undo2, MessageCircle, Copy,
} from 'lucide-react';

/* ============================== Icon registry (string keys, storage-safe) ============================== */

const ICONS = {
  BrainCircuit, Leaf, Zap, Atom, Scale, Sparkles, FileText, Link2, Video,
  ExternalLink, Database, Bookmark, Network, MessageCircleQuestion, Quote,
};
const Icon = ({ name, ...props }) => {
  const Cmp = ICONS[name] || Sparkles;
  return <Cmp {...props} />;
};

/* ============================== Backend API client ============================== */
// Points at the lens-backend server. Resolution order:
// 1. VITE_API_BASE env var, set at build time (e.g. in Vercel project settings)
// 2. window.__LENS_API_BASE__, settable at runtime (e.g. in index.html)
// 3. localhost:4000, for local dev against a locally running backend
const API_BASE = import.meta.env.VITE_API_BASE
  || (typeof window !== 'undefined' && window.__LENS_API_BASE__)
  || 'http://localhost:4000/api';
// Google OAuth Web Client ID (Identity Services / ID-token flow — no client secret needed).
// Override via window.__LENS_GOOGLE_CLIENT_ID__ if you need a different one per environment.
const GOOGLE_CLIENT_ID = (typeof window !== 'undefined' && window.__LENS_GOOGLE_CLIENT_ID__)
  || '719386172464-s9fotm6bild4uibhdir0u7ds5jre0qrq.apps.googleusercontent.com';
const TOKEN_KEY = 'lens_token';

function getToken() {
  try { return window.sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setToken(token) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

async function apiRequest(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // For FormData, the browser sets Content-Type itself (including the
  // multipart boundary) — setting it manually breaks the upload.
  if (!formData) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error('Could not reach the LENS server. Is the backend running on localhost:4000?');
  }

  if (res.status === 204) return null;

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

const api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  postForm: (path, formData) => apiRequest(path, { method: 'POST', formData }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
  del: (path) => apiRequest(path, { method: 'DELETE' }),
};

/* ============================== (Seed data now lives in the backend — see lens-backend/src/seedData.js) ============================== */
/* ============================== Static UI data (unchanged) ============================== */

const NAV_ITEMS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'investigations', label: 'My Investigations', icon: FolderOpen },
  { key: 'sources', label: 'Sources', icon: Database },
  { key: 'maps', label: 'Maps', icon: Network },
  { key: 'saved', label: 'Saved', icon: Bookmark },
];
const NAV_ITEMS_SECONDARY = [
  { key: 'shared', label: 'Shared with me', icon: Users },
  { key: 'trash', label: 'Trash', icon: Trash2 },
];
const CHIPS = [
  { key: 'URL', label: 'URL', icon: Link2, color: '#38BDF8', pos: { left: '19%', top: '20%' }, pull: { x: 72, y: 44 }, delay: '0s' },
  { key: 'Research Paper', label: 'Research Paper', icon: FileText, color: '#818CF8', pos: { left: '83%', top: '18%' }, pull: { x: -72, y: 48 }, delay: '1.1s' },
  { key: 'PDF', label: 'PDF', icon: FileText, color: '#FB7185', pos: { left: '18%', top: '80%' }, pull: { x: 72, y: -44 }, delay: '2.2s' },
  { key: 'YouTube', label: 'YouTube Video', icon: Video, color: '#F43F5E', pos: { left: '84%', top: '82%' }, pull: { x: -72, y: -48 }, delay: '0.6s' },
];
const INVESTIGATION_FILTER_TABS = ['All', 'In Progress', 'Completed', 'Shared'];
const SOURCE_TYPE_TABS = ['All', 'URL', 'PDF', 'YouTube', 'Research Paper', 'Article'];
const SOURCE_TYPE_STYLES = {
  'Research Paper': { color: '#C4B5FD', bg: 'rgba(167,139,250,0.16)' },
  Article: { color: '#93C5FD', bg: 'rgba(96,165,250,0.14)' },
  YouTube: { color: '#FCA5A5', bg: 'rgba(248,113,113,0.16)' },
  PDF: { color: '#5EEAD4', bg: 'rgba(45,212,191,0.16)' },
  URL: { color: '#7DD3FC', bg: 'rgba(56,189,248,0.16)' },
};
const MAP_FILTER_TABS = ['All', 'Public', 'Private', 'Shared with me'];
const VISIBILITY_STYLES = {
  Public: { color: '#5EEAD4', bg: 'rgba(45,212,191,0.14)' },
  Private: { color: '#C7CCDC', bg: 'rgba(255,255,255,0.06)' },
  Shared: { color: '#FCD34D', bg: 'rgba(245,158,11,0.14)' },
};
const SAVED_TYPE_STYLES = {
  Concepts: { label: 'Concept', color: '#C4B5FD', bg: 'rgba(167,139,250,0.16)' },
  Claims: { label: 'Claim', color: '#5EEAD4', bg: 'rgba(45,212,191,0.16)' },
  Questions: { label: 'Question', color: '#7DD3FC', bg: 'rgba(56,189,248,0.16)' },
  Sources: { label: 'Source', color: '#FCA5A5', bg: 'rgba(248,113,113,0.16)' },
  Maps: { label: 'Map', color: '#FCD34D', bg: 'rgba(245,158,11,0.16)' },
};
const SAVED_FILTER_TABS = ['All', 'Concepts', 'Claims', 'Sources', 'Questions', 'Maps'];
const INVESTIGATION_TABS = ['Overview', 'Map', 'Sources', 'Claims', 'Questions'];

/* ============================== App-wide context via props drilling (kept simple) ============================== */

const AppCtx = React.createContext(null);
const useApp = () => React.useContext(AppCtx);

/* ============================== Small shared bits ============================== */

function MiniGraph({ nodes, edges, tint, height = 'h-24' }) {
  return (
    <svg viewBox="0 0 100 90" className={`w-full ${height}`} preserveAspectRatio="none">
      {edges.map(([a, b], i) => (
        nodes[a] && nodes[b] ? (
          <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
            stroke={tint} strokeOpacity="0.35" strokeWidth="0.6" />
        ) : null
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 2 === 0 ? 2.4 : 1.6} fill={tint}
          className="mini-node" style={{ animationDelay: `${i * 0.35}s` }} />
      ))}
    </svg>
  );
}

function Pill({ label, color, bg }) {
  return <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ color, background: bg }}>{label}</span>;
}

function FilterTabs({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1 w-fit">
      {tabs.map((tab) => (
        <button key={tab} onClick={() => onChange(tab)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            active === tab ? 'bg-gradient-to-r from-violet-500/25 to-blue-500/15 text-white border border-white/10' : 'text-[#8891A8] hover:text-white'
          }`}>
          {tab}
        </button>
      ))}
    </div>
  );
}

function SearchBox({ placeholder, value, onChange, onFocus }) {
  return (
    <div className="flex items-center gap-2.5 flex-1 max-w-xs rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-[#8891A8] focus-within:border-white/20 transition-colors">
      <Search size={15} />
      <input
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className="flex-1 truncate bg-transparent outline-none text-[#EDEFF6] placeholder:text-[#8891A8]"
      />
      {value ? (
        <button onClick={() => onChange && onChange('')} className="text-[#666F87] hover:text-white flex-none">
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

function PrimaryButton({ children, icon: IconCmp, onClick, type = 'button', disabled }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-gradient-to-r from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 transition-colors shadow-[0_0_24px_rgba(124,58,237,0.35)] disabled:opacity-50 disabled:cursor-not-allowed">
      {IconCmp && <IconCmp size={15} />}
      {children}
    </button>
  );
}

function GhostButton({ children, icon: IconCmp, onClick, className = '' }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-[#C7CCDC] hover:text-white hover:bg-white/[0.06] transition-colors ${className}`}>
      {IconCmp && <IconCmp size={14} />}
      {children}
    </button>
  );
}

function SortDropdown({ label = 'Recent', options = ['Recent', 'A \u2013 Z', 'Oldest'], onChange }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(label);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[#C7CCDC] hover:text-white transition-colors">
        {current} <ChevronDown size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-36 rounded-lg border border-white/10 bg-[#0A0A10] shadow-2xl z-30 overflow-hidden">
            {options.map((opt) => (
              <button key={opt} onClick={() => { setCurrent(opt); setOpen(false); onChange && onChange(opt); }}
                className="w-full text-left px-3 py-2 text-sm text-[#C7CCDC] hover:bg-white/[0.06] hover:text-white transition-colors">
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PageHeader({ title, subtitle, search, searchValue, onSearchChange, actions }) {
  return (
    <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
      <div>
        <h1 className="font-display font-semibold text-2xl">{title}</h1>
        <p className="text-sm text-[#8891A8] mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2.5">
        {search && <SearchBox placeholder={search} value={searchValue} onChange={onSearchChange} />}
        {actions}
      </div>
    </div>
  );
}

function ProgressBar({ percent, tint }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, background: tint }} />
      </div>
      <span className="text-xs text-[#8891A8] w-8 text-right">{percent}%</span>
    </div>
  );
}

function SaveToggle({ saved, onClick, size = 14 }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={saved ? 'Unsave' : 'Save'}
      className={`flex items-center justify-center w-7 h-7 rounded-md border transition-colors flex-none ${
        saved ? 'border-violet-400/40 bg-violet-500/15 text-violet-300' : 'border-white/10 text-[#666F87] hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      <Bookmark size={size} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}

function EmptyState({ icon: IconCmp, title, subtitle, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] py-20 flex flex-col items-center justify-center text-center px-6">
      <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
        <IconCmp size={18} className="text-[#666F87]" />
      </div>
      <p className="text-sm font-medium text-[#C7CCDC]">{title}</p>
      {subtitle && <p className="text-sm text-[#8891A8] mt-1 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- Modal shell ---------------- */
function Modal({ open, onClose, children, maxWidth = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} rounded-2xl border border-white/10 bg-[#0A0A10] shadow-2xl max-h-[85vh] overflow-y-auto`}>
        {children}
      </div>
    </div>
  );
}
function ModalHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] sticky top-0 bg-[#0A0A10] z-10">
      <h3 className="font-display font-semibold text-lg">{title}</h3>
      <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#8891A8] hover:text-white hover:bg-white/[0.06] transition-colors">
        <X size={16} />
      </button>
    </div>
  );
}

/* ============================== Login / Signup ============================== */

/* ============================== Animated intro (pre-auth landing) ============================== */

const INTRO_CHIP_DEFS = [
  {
    cls: 'url', color: '#38BDF8', label: 'https://…',
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
      </svg>
    ),
  },
  {
    cls: 'pdf', color: '#FB7145', label: 'research.pdf',
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 2h9l5 5v15H6z" opacity=".25" />
        <path d="M6 2h9l5 5v15H6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <text x="7.2" y="16" fontSize="7" fill="currentColor" fontFamily="sans-serif" stroke="none">PDF</text>
      </svg>
    ),
  },
  {
    cls: 'yt', color: '#A78BFA', label: 'youtube.com/watch?v=…',
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    cls: 'paper', color: '#60A5FA', label: 'AI Paper.pdf',
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="3" width="16" height="18" rx="1.5" />
        <path d="M7.5 8h9M7.5 12h9M7.5 16h5" />
      </svg>
    ),
  },
];

const INTRO_ICON_DEFS = [
  { glyph: '▤', color: '#60A5FA' }, { glyph: '▶', color: '#A78BFA' },
  { glyph: '▦', color: '#2DD4BF' }, { glyph: '◐', color: '#FB7185' },
  { glyph: '✎', color: '#FBBF24' }, { glyph: '♪', color: '#38BDF8' },
  { glyph: '❖', color: '#A78BFA' }, { glyph: '▧', color: '#F472B6' },
];

const INTRO_T = {
  chipEnd: 2200, flash1: 2200,
  ringStart: 2300, ringGrow: 600,
  iconsIn: 3400, collapseStart: 4300, collapseDur: 400,
  flash2: 4600,
  wordIn: 4950, tagIn: 5450,
  logoIn: 6200, loginIn: 6700, replayIn: 7600,
};

function introEase(t) { return 1 - Math.pow(1 - t, 3); }
function introEaseIn(t) { return t * t * t; }
function introBezier(p0, p1, p2, t) {
  const it = 1 - t;
  return { x: it * it * p0.x + 2 * it * t * p1.x + t * t * p2.x, y: it * it * p0.y + 2 * it * t * p1.y + t * t * p2.y };
}
function introHexA(hex, a) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16), g = parseInt(c.substring(2, 4), 16), b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

function LoginView({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const stageRef = useRef(null);
  const cvRef = useRef(null);
  const globeRef = useRef(null);
  const chipRefs = useRef([]);
  const iconRefs = useRef([]);
  const wordmarkRef = useRef(null);
  const taglineRef = useRef(null);
  const logoRingRef = useRef(null);
  const loginRef = useRef(null);
  const replayRef = useRef(null);

  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setError('Please fill in email and password.'); return; }
    if (mode === 'signup' && !name.trim()) { setError('Please tell us your name.'); return; }
    setError('');
    setBusy(true);
    try {
      const path = mode === 'signup' ? '/auth/signup' : '/auth/login';
      const payload = mode === 'signup'
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };
      const data = await api.post(path, payload);
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const googleBtnRef = useRef(null);
  const onLoginRef = useRef(onLogin);
  onLoginRef.current = onLogin;

  // Loads Google's Identity Services script once and renders their real
  // "Sign in with Google" button into googleBtnRef. The button hands us
  // back a signed ID token, which we send to POST /api/auth/google —
  // no client secret or redirect dance needed for this flow.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const handleCredential = async (response) => {
      setError('');
      setBusy(true);
      try {
        const data = await api.post('/auth/google', { credential: response.credential });
        onLoginRef.current(data);
      } catch (err) {
        setError(err.message);
        setFormOpen(true);
      } finally {
        setBusy(false);
      }
    };

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard', theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 320,
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      let script = document.getElementById('google-identity-script');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.id = 'google-identity-script';
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderGoogleButton, { once: true });
    }
  }, []);

  const googleLogin = () => {
    // Fallback only — reachable if GOOGLE_CLIENT_ID isn't configured, in
    // which case the real Google button above never renders.
    setFormOpen(true);
    setError('Google sign-in isn\u2019t configured on this deployment — continue with email or as a guest.');
  };

  const guestLogin = async () => {
    setError('');
    setBusy(true);
    try {
      const data = await api.post('/auth/guest');
      onLogin(data);
    } catch (err) {
      setError(err.message);
      setFormOpen(true);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const stage = stageRef.current;
    const cv = cvRef.current;
    const globeCanvas = globeRef.current;
    const ctx = cv.getContext('2d');
    const chips = chipRefs.current;
    const wordmark = wordmarkRef.current;
    const tagline = taglineRef.current;
    const logoRing = logoRingRef.current;
    const login = loginRef.current;
    const replayBtn = replayRef.current;

    let G = {};
    let particles = [];
    let flash1 = 0, flash2 = 0;
    let t0 = performance.now();
    let last = t0;
    let lastSpawnT = -1;
    let timeouts = [];
    let raf;

    function layout() {
      const w = stage.clientWidth, h = stage.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const center = { x: w / 2, y: h / 2 };
      const corners = [
        { x: w * 0.16, y: h * 0.16 },
        { x: w * 0.84, y: h * 0.16 },
        { x: w * 0.16, y: h * 0.84 },
        { x: w * 0.84, y: h * 0.84 },
      ];
      const colors = INTRO_CHIP_DEFS.map((c) => c.color);
      const ringRadius = Math.min(w, h) * 0.16;
      G = { w, h, center, corners, colors, ringRadius };

      const r = Math.min(w, h) * 0.30;
      INTRO_ICON_DEFS.forEach((d, i) => {
        const el = iconRefs.current[i];
        if (!el) return;
        const ang = (i / INTRO_ICON_DEFS.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
        el.style.setProperty('--x', x.toFixed(1) + 'px');
        el.style.setProperty('--y', y.toFixed(1) + 'px');
      });

      resizeGlobe();
    }

    // ---------- background globe ----------
    let globeReady = false, globeScene, globeCamera, globeRenderer, globeGroup;
    function initGlobe() {
      globeRenderer = new THREE.WebGLRenderer({ canvas: globeCanvas, alpha: true, antialias: true });
      globeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      globeScene = new THREE.Scene();
      globeCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
      globeCamera.position.set(0, 0, 7.2);

      globeGroup = new THREE.Group();
      globeGroup.rotation.x = 0.28;
      globeScene.add(globeGroup);

      const R = 2.4;
      const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 48, 48), new THREE.MeshBasicMaterial({ color: 0x05070d }));
      globeGroup.add(core);

      const wireGeo = new THREE.SphereGeometry(R, 24, 16);
      const wire = new THREE.LineSegments(new THREE.WireframeGeometry(wireGeo), new THREE.LineBasicMaterial({ color: 0x1c4a4f, transparent: true, opacity: 0.35 }));
      globeGroup.add(wire);

      function toXYZ(lat, lng, r) {
        const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
        return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
      }

      const pts = [];
      for (let i = 0; i < 42; i++) pts.push(toXYZ(Math.random() * 140 - 70, Math.random() * 360 - 180, R * 1.006));

      const dotGeo = new THREE.SphereGeometry(0.028, 6, 6);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x5eead4 });
      pts.forEach((p) => { const m = new THREE.Mesh(dotGeo, dotMat); m.position.copy(p); globeGroup.add(m); });

      const arcMat = new THREE.LineBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.45 });
      for (let i = 0; i < 20; i++) {
        const a = pts[Math.floor(Math.random() * pts.length)];
        const b = pts[Math.floor(Math.random() * pts.length)];
        if (a === b) continue;
        const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.35);
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
        globeGroup.add(new THREE.Line(geo, arcMat));
      }
      globeReady = true;
      resizeGlobe();
    }
    function resizeGlobe() {
      if (!globeReady) return;
      const w = stage.clientWidth, h = stage.clientHeight;
      globeRenderer.setSize(w, h, false);
      globeCamera.aspect = w / h;
      globeCamera.updateProjectionMatrix();
    }

    function spawn(x, y, color, opts) {
      opts = opts || {};
      const speed = opts.speed != null ? opts.speed : 0.3 + Math.random() * 0.6;
      const ang = opts.angle != null ? opts.angle : Math.random() * Math.PI * 2;
      particles.push({
        x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        life: opts.life || 500 + Math.random() * 500, age: 0,
        r: opts.r || 1.2 + Math.random() * 1.8, color,
      });
    }

    function scheduleAll() {
      timeouts.forEach(clearTimeout);
      timeouts = [];
      const add = (fn, ms) => timeouts.push(setTimeout(fn, ms));
      add(() => iconRefs.current.forEach((el) => el && el.classList.add('show')), INTRO_T.iconsIn);
      add(() => iconRefs.current.forEach((el) => el && el.classList.remove('show')), INTRO_T.collapseStart);
      add(() => wordmark.classList.add('show'), INTRO_T.wordIn);
      add(() => tagline.classList.add('show'), INTRO_T.tagIn);
      add(() => globeCanvas.classList.add('show'), INTRO_T.tagIn);
      add(() => logoRing.classList.add('show'), INTRO_T.logoIn);
      add(() => login.classList.add('show'), INTRO_T.loginIn);
      add(() => replayBtn.classList.add('show'), INTRO_T.replayIn);
    }

    function resetVisuals() {
      particles = [];
      flash1 = 0; flash2 = 0;
      lastSpawnT = -1;
      iconRefs.current.forEach((el) => el && el.classList.remove('show'));
      wordmark.classList.remove('show');
      tagline.classList.remove('show');
      logoRing.classList.remove('show');
      login.classList.remove('show');
      replayBtn.classList.remove('show');
      globeCanvas.classList.remove('show');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, G.w, G.h);
    }

    function onReplay() {
      setFormOpen(false);
      setMode('login');
      setError('');
      t0 = performance.now();
      resetVisuals();
      scheduleAll();
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = now - last; last = now;
      const t = now - t0;

      ctx.fillStyle = 'rgba(5,7,13,0.16)';
      ctx.fillRect(0, 0, G.w, G.h);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const seed = i * 97.3;
        const sx = (Math.sin(seed) * 0.5 + 0.5) * G.w;
        const sy = (Math.cos(seed * 1.7) * 0.5 + 0.5) * G.h;
        const tw = 0.35 + 0.35 * Math.sin(now / 900 + i);
        ctx.fillStyle = 'rgba(160,180,255,' + Math.max(0, tw).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      if (t < INTRO_T.chipEnd) {
        const p = Math.min(1, t / INTRO_T.chipEnd);
        const pe = introEaseIn(p);
        chips.forEach((chip, i) => {
          if (!chip) return;
          const start = G.corners[i], end = G.center, color = G.colors[i];
          const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
          const dir = { x: end.x - start.x, y: end.y - start.y };
          const perp = { x: -dir.y, y: dir.x };
          const plen = Math.hypot(perp.x, perp.y) || 1;
          const swirl = 0.28;
          const ctrl = { x: mid.x + (perp.x / plen) * plen * swirl, y: mid.y + (perp.y / plen) * plen * swirl };
          const pos = introBezier(start, ctrl, end, pe);
          chip.style.transform = `translate(${pos.x}px,${pos.y}px)`;
          chip.style.opacity = p < 0.78 ? 1 : Math.max(0, 1 - (p - 0.78) / 0.22);
          if (Math.floor(t / 28) !== lastSpawnT) {
            spawn(pos.x, pos.y, color, { speed: 0.15 + Math.random() * 0.3, life: 450 + Math.random() * 350, r: 1 + Math.random() * 1.6 });
          }
        });
        if (Math.floor(t / 28) !== lastSpawnT) lastSpawnT = Math.floor(t / 28);
      } else {
        chips.forEach((c) => { if (c) c.style.opacity = 0; });
      }

      if (t >= INTRO_T.flash1 && t < INTRO_T.flash1 + 40 && flash1 === 0) {
        flash1 = 1;
        for (let i = 0; i < 140; i++) {
          spawn(G.center.x, G.center.y, Math.random() < 0.5 ? '#8FA3FF' : '#C8D3FF', {
            speed: 1 + Math.random() * 4, angle: Math.random() * Math.PI * 2,
            life: 600 + Math.random() * 700, r: 1 + Math.random() * 2.2,
          });
        }
      }
      if (flash1 > 0) {
        flash1 = Math.max(0, flash1 - dt / 380);
        if (flash1 > 0) {
          const g = ctx.createRadialGradient(G.center.x, G.center.y, 0, G.center.x, G.center.y, G.ringRadius * 3);
          g.addColorStop(0, `rgba(255,255,255,${0.85 * flash1})`);
          g.addColorStop(0.3, `rgba(150,170,255,${0.5 * flash1})`);
          g.addColorStop(1, 'rgba(150,170,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, G.w, G.h);
        }
      }

      if (t >= INTRO_T.flash2 && t < INTRO_T.flash2 + 40 && flash2 === 0) {
        flash2 = 1;
        for (let i = 0; i < 70; i++) {
          spawn(G.center.x, G.center.y, '#B9C4FF', {
            speed: 0.6 + Math.random() * 2.6, angle: Math.random() * Math.PI * 2,
            life: 400 + Math.random() * 400, r: 0.8 + Math.random() * 1.6,
          });
        }
      }
      if (flash2 > 0) {
        flash2 = Math.max(0, flash2 - dt / 300);
        if (flash2 > 0) {
          const g = ctx.createRadialGradient(G.center.x, G.center.y, 0, G.center.x, G.center.y, G.ringRadius * 1.6);
          g.addColorStop(0, `rgba(255,255,255,${0.7 * flash2})`);
          g.addColorStop(1, 'rgba(150,170,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, G.w, G.h);
        }
      }

      let ringR = 0;
      if (t >= INTRO_T.ringStart && t < INTRO_T.collapseStart) {
        ringR = G.ringRadius * introEase(Math.min(1, (t - INTRO_T.ringStart) / INTRO_T.ringGrow));
      } else if (t >= INTRO_T.collapseStart && t < INTRO_T.collapseStart + INTRO_T.collapseDur) {
        ringR = G.ringRadius * (1 - introEaseIn((t - INTRO_T.collapseStart) / INTRO_T.collapseDur));
      }
      if (ringR > 1) {
        const rot = t / 6000;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(140,170,255,0.6)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(G.center.x, G.center.y, ringR, 0, Math.PI * 2); ctx.stroke();
        const spokes = 16;
        for (let i = 0; i < spokes; i++) {
          const a = rot * Math.PI * 2 + (i / spokes) * Math.PI * 2;
          const r1 = ringR * 0.3, r2 = ringR * 1.35;
          ctx.strokeStyle = `rgba(150,170,255,${0.16 + 0.1 * Math.sin(a * 3 + t / 500)})`;
          ctx.beginPath();
          ctx.moveTo(G.center.x + Math.cos(a) * r1, G.center.y + Math.sin(a) * r1);
          ctx.lineTo(G.center.x + Math.cos(a) * r2, G.center.y + Math.sin(a) * r2);
          ctx.stroke();
        }
        const core = ctx.createRadialGradient(G.center.x, G.center.y, 0, G.center.x, G.center.y, ringR * 0.5);
        core.addColorStop(0, 'rgba(255,255,255,0.9)');
        core.addColorStop(1, 'rgba(150,170,255,0)');
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(G.center.x, G.center.y, ringR * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      particles.forEach((p) => {
        p.age += dt;
        p.x += p.vx * (dt / 16.6); p.y += p.vy * (dt / 16.6);
        p.vx *= 0.985; p.vy *= 0.985;
      });
      particles = particles.filter((p) => p.age < p.life);
      particles.forEach((p) => {
        const a = Math.max(0, 1 - p.age / p.life);
        ctx.fillStyle = introHexA(p.color, a);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();

      if (globeReady) {
        globeGroup.rotation.y += 0.00028 * dt;
        globeRenderer.render(globeScene, globeCamera);
      }
    }

    layout();
    initGlobe();
    resetVisuals();
    scheduleAll();
    raf = requestAnimationFrame(frame);

    window.addEventListener('resize', layout);
    replayBtn.addEventListener('click', onReplay);

    return () => {
      cancelAnimationFrame(raf);
      timeouts.forEach(clearTimeout);
      window.removeEventListener('resize', layout);
      replayBtn.removeEventListener('click', onReplay);
      if (globeRenderer) {
        globeScene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        globeRenderer.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={stageRef} className="relative w-full h-screen bg-[#05070D] text-[#EDEFF6] overflow-hidden select-none">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500&display=swap');
        * { font-family:'IBM Plex Sans',sans-serif; box-sizing:border-box; }
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .lens-canvas { position:absolute; inset:0; display:block; }
        #globe-cv { opacity:0; transition: opacity 1.6s ease; pointer-events:none; }
        #globe-cv.show { opacity:0.55; }

        .chip { position:absolute; left:0; top:0; display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:10px;
          background:rgba(10,14,24,0.55); border:1px solid rgba(255,255,255,0.12); backdrop-filter:blur(6px);
          color:#E5EAF5; font-size:12px; white-space:nowrap; will-change:transform,opacity; pointer-events:none; }
        .chip .ic { width:16px; height:16px; flex:none; }
        .chip.url .ic { color:#38BDF8; } .chip.pdf .ic { color:#FB7145; } .chip.yt .ic { color:#A78BFA; } .chip.paper .ic { color:#60A5FA; }

        .orbit-icon { position:absolute; left:50%; top:50%; width:40px; height:40px; border-radius:50%;
          display:flex; align-items:center; justify-content:center; background:rgba(10,14,24,0.6);
          border:1px solid currentColor; font-size:15px; opacity:0;
          transform:translate(-50%,-50%) translate(0,0) scale(0.3);
          transition: opacity .5s ease, transform .55s cubic-bezier(.2,.8,.2,1); pointer-events:none; }
        .orbit-icon.show { opacity:1; transform:translate(-50%,-50%) translate(var(--x),var(--y)) scale(1); }

        #textblock { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; pointer-events:none; }
        #logo-ring { width:56px; height:56px; opacity:0; transform:scale(0.4); transition:opacity .6s ease, transform .6s cubic-bezier(.2,.8,.2,1); }
        #logo-ring.show { opacity:1; transform:scale(1); }
        #logo-ring svg { width:100%; height:100%; animation: lens-spin 6s linear infinite; }
        @keyframes lens-spin { to { transform: rotate(360deg); } }

        #wordmark { display:flex; gap:10px; }
        #wordmark span { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:clamp(34px,9vw,56px);
          color:#F3F6FF; letter-spacing:2px; opacity:0; transform:translateY(14px);
          transition:opacity .6s ease, transform .6s cubic-bezier(.2,.8,.2,1); text-shadow:0 0 24px rgba(140,150,255,0.5); }
        #wordmark.show span { opacity:1; transform:translateY(0); }
        #wordmark.show span:nth-child(1){transition-delay:.03s} #wordmark.show span:nth-child(2){transition-delay:.11s}
        #wordmark.show span:nth-child(3){transition-delay:.19s} #wordmark.show span:nth-child(4){transition-delay:.27s}

        #tagline { color:#9AA7C7; font-size:14px; text-align:center; line-height:1.5; opacity:0; transform:translateY(8px);
          transition:opacity .6s ease, transform .6s ease; }
        #tagline.show { opacity:1; transform:translateY(0); }

        #login { position:absolute; left:50%; bottom:6%; transform:translate(-50%,24px); width:min(360px,90vw);
          background:rgba(10,13,22,0.78); border:1px solid rgba(255,255,255,0.1); border-radius:18px; padding:18px;
          backdrop-filter:blur(12px); opacity:0; pointer-events:none; max-height:76vh; overflow-y:auto;
          transition:opacity .6s ease, transform .6s cubic-bezier(.2,.8,.2,1); box-shadow:0 20px 60px rgba(0,0,0,0.5); }
        #login.show { opacity:1; transform:translate(-50%,0); pointer-events:auto; }

        .lens-btn { display:flex; align-items:center; justify-content:center; gap:10px; width:100%; padding:11px 14px;
          border-radius:10px; font-size:14px; cursor:pointer; border:1px solid rgba(255,255,255,0.14); background:none;
          opacity:0; transform:translateY(8px); transition:opacity .45s ease, transform .45s ease, filter .15s ease; }
        .lens-btn:hover { filter:brightness(1.08); }
        #login.show .lens-btn { opacity:1; transform:translateY(0); }
        #login.show .lens-btn.google { transition-delay:.1s; }
        .lens-btn.google { background:#F3F6FF; color:#1A1E2B; font-weight:500; margin-bottom:12px; }
        .g-badge { width:18px; height:18px; border-radius:50%; flex:none; background:#4B5DFF; color:#fff;
          font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; }

        .lens-divider { display:flex; align-items:center; gap:10px; margin-bottom:12px; opacity:0; transition:opacity .45s ease .16s; }
        #login.show .lens-divider { opacity:1; }
        .lens-divider .ln { height:1px; flex:1; background:rgba(255,255,255,0.1); }
        .lens-divider span { font-size:10.5px; color:#666F87; letter-spacing:1px; }

        .lens-field { display:flex; align-items:center; gap:9px; border-radius:10px; border:1px solid rgba(255,255,255,0.1);
          background:rgba(255,255,255,0.03); padding:10px 12px; font-size:13.5px; margin-bottom:9px;
          opacity:0; transform:translateY(8px); transition:opacity .45s ease, transform .45s ease; }
        #login.show .lens-field { opacity:1; transform:translateY(0); }
        #login.show .lens-field.f1 { transition-delay:.2s; } #login.show .lens-field.f2 { transition-delay:.26s; } #login.show .lens-field.f3 { transition-delay:.32s; }
        .lens-field svg { color:#666F87; flex:none; }
        .lens-field input { flex:1; background:none; border:none; outline:none; color:#F3F6FF; font-size:13.5px; }
        .lens-field input::placeholder { color:#5C6685; }

        .lens-submit { background:linear-gradient(135deg,#7C3AED,#38BDF8); color:#fff; font-weight:500; border:none;
          margin-top:2px; opacity:0; transform:translateY(8px); transition:opacity .45s ease .38s, transform .45s ease .38s, filter .15s ease; }
        #login.show .lens-submit { opacity:1; transform:translateY(0); }

        .lens-error { color:#FCA5A5; font-size:12px; margin:2px 0 8px; opacity:0; transition:opacity .3s ease; }
        .lens-error.show { opacity:1; }

        .lens-toggle-row { text-align:center; margin-top:12px; font-size:12.5px; color:#8891A8; opacity:0; transition:opacity .45s ease .4s; }
        #login.show .lens-toggle-row { opacity:1; }
        .lens-toggle-row button { background:none; border:none; cursor:pointer; color:#A78BFA; font-weight:500; font-size:12.5px; }
        .lens-toggle-row button:hover { color:#C4B5FD; }

        .guest { display:block; width:100%; text-align:center; margin-top:10px; font-size:12.5px; color:#9AA7C7;
          background:none; border:none; cursor:pointer; text-decoration:none; opacity:0; transition:opacity .45s ease .44s; }
        #login.show .guest { opacity:1; }
        .guest:hover { color:#C6CEE6; }

        #replay { position:absolute; top:18px; right:18px; z-index:5; display:flex; align-items:center; gap:6px; font-size:12px;
          color:#9AA7C7; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12);
          padding:7px 12px; border-radius:999px; cursor:pointer; opacity:0; pointer-events:none; transition:opacity .5s ease; }
        #replay.show { opacity:1; pointer-events:auto; }
        #replay:hover { background:rgba(255,255,255,0.1); }
      `}</style>

      <canvas ref={cvRef} className="lens-canvas" />
      <canvas ref={globeRef} id="globe-cv" className="lens-canvas" />

      {INTRO_CHIP_DEFS.map((c, i) => (
        <div key={c.cls} ref={(el) => (chipRefs.current[i] = el)} className={`chip ${c.cls}`}>
          {c.icon}
          <span>{c.label}</span>
        </div>
      ))}

      <div id="orbit">
        {INTRO_ICON_DEFS.map((d, i) => (
          <div
            key={i}
            ref={(el) => (iconRefs.current[i] = el)}
            className="orbit-icon"
            style={{ color: d.color, transitionDelay: `${i * 0.05}s` }}
          >
            {d.glyph}
          </div>
        ))}
      </div>

      <div id="textblock">
        <div ref={logoRingRef} id="logo-ring">
          <svg viewBox="0 0 56 56">
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#38BDF8" />
                <stop offset="1" stopColor="#A78BFA" />
              </linearGradient>
            </defs>
            <circle cx="28" cy="28" r="22" fill="none" stroke="url(#lg)" strokeWidth="4" strokeLinecap="round" strokeDasharray="120 20" />
          </svg>
        </div>
        <div ref={wordmarkRef} id="wordmark">
          <span>L</span><span>E</span><span>N</span><span>S</span>
        </div>
        <div ref={taglineRef} id="tagline">Explore the internet,<br />not just read it.</div>
      </div>

      <div ref={loginRef} id="login">
        {!formOpen ? (
          <>
            {GOOGLE_CLIENT_ID ? (
              <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, minHeight: 40 }} />
            ) : (
              <button className="lens-btn google" onClick={googleLogin}>
                <span className="g-badge">G</span><span>Continue with Google</span>
              </button>
            )}
            <button className="lens-btn email" style={{ background: 'rgba(255,255,255,0.04)', color: '#E5EAF5', marginBottom: 0 }} onClick={() => setFormOpen(true)}>
              <Mail size={15} />
              <span>Continue with Email</span>
            </button>
            <button className="guest" onClick={guestLogin}>Explore as guest →</button>
          </>
        ) : (
          <>
            <h1 className="font-display font-semibold text-[17px] text-center mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-[12.5px] text-[#8891A8] text-center mb-4">
              {mode === 'login' ? 'Sign in to continue exploring.' : 'Start turning information into clarity.'}
            </p>
            <form onSubmit={submit}>
              {mode === 'signup' && (
                <div className="lens-field f1">
                  <User size={15} />
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                </div>
              )}
              <div className="lens-field f2">
                <Mail size={15} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
              </div>
              <div className="lens-field f3">
                <Lock size={15} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
              </div>
              <p className={`lens-error ${error ? 'show' : ''}`}>{error}</p>
              <button type="submit" className="lens-btn lens-submit" disabled={busy}>
                {busy ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create account')} <ArrowRight size={15} />
              </button>
            </form>
            <div className="lens-toggle-row">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
            <button className="guest" onClick={() => setFormOpen(false)}>← Back</button>
          </>
        )}
      </div>

      <div ref={replayRef} id="replay">↺ Replay</div>
    </div>
  );
}

/* ============================== Command palette (global search) ============================== */

function CommandPalette({ open, onClose }) {
  const { investigations, sources, maps, navigate } = useApp();
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current && inputRef.current.focus(), 30); }, [open]);
  useEffect(() => { if (!open) setQ(''); }, [open]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return null;
    const invs = investigations.filter((i) => !i.trashed && i.title.toLowerCase().includes(query)).slice(0, 5);
    const srcs = sources.filter((s) => s.title.toLowerCase().includes(query) || s.domain.toLowerCase().includes(query)).slice(0, 5);
    const mps = maps.filter((m) => m.title.toLowerCase().includes(query)).slice(0, 5);
    const concepts = [];
    const claims = [];
    const questions = [];
    investigations.forEach((inv) => {
      if (inv.trashed) return;
      inv.concepts.forEach((c) => { if (c.label.toLowerCase().includes(query)) concepts.push({ ...c, inv }); });
      inv.claims.forEach((c) => { if (c.text.toLowerCase().includes(query)) claims.push({ ...c, inv }); });
      inv.questions.forEach((c) => { if (c.text.toLowerCase().includes(query)) questions.push({ ...c, inv }); });
    });
    return { invs, srcs, mps, concepts: concepts.slice(0, 5), claims: claims.slice(0, 5), questions: questions.slice(0, 5) };
  }, [q, investigations, sources, maps]);

  const hasAny = results && (results.invs.length || results.srcs.length || results.mps.length || results.concepts.length || results.claims.length || results.questions.length);

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-xl">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
        <Search size={16} className="text-[#666F87]" />
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search investigations, sources, maps, concepts, claims…"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#666F87]" />
        <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-[#666F87]">ESC</kbd>
      </div>
      <div className="max-h-[60vh] overflow-y-auto py-2">
        {!q && <p className="px-5 py-8 text-sm text-[#666F87] text-center">Start typing to search everything in LENS.</p>}
        {q && !hasAny && <p className="px-5 py-8 text-sm text-[#666F87] text-center">No results for "{q}".</p>}
        {results && results.invs.length > 0 && (
          <ResultGroup label="Investigations">
            {results.invs.map((i) => (
              <ResultRow key={i.key} title={i.title} sub={`${i.status} \u00b7 ${i.visibility}`} tint={i.tint}
                onClick={() => { navigate('investigation', i.key); onClose(); }} />
            ))}
          </ResultGroup>
        )}
        {results && results.srcs.length > 0 && (
          <ResultGroup label="Sources">
            {results.srcs.map((s) => (
              <ResultRow key={s.key} title={s.title} sub={s.domain} tint={s.tint}
                onClick={() => { navigate('sources'); onClose(); }} />
            ))}
          </ResultGroup>
        )}
        {results && results.mps.length > 0 && (
          <ResultGroup label="Maps">
            {results.mps.map((m) => (
              <ResultRow key={m.key} title={m.title} sub={`From: ${m.from}`} tint={m.tint}
                onClick={() => { navigate('investigation', m.invKey, 'Map'); onClose(); }} />
            ))}
          </ResultGroup>
        )}
        {results && results.concepts.length > 0 && (
          <ResultGroup label="Concepts">
            {results.concepts.map((c) => (
              <ResultRow key={c.id} title={c.label} sub={`From: ${c.inv.title}`} tint={c.inv.tint}
                onClick={() => { navigate('investigation', c.inv.key, 'Map'); onClose(); }} />
            ))}
          </ResultGroup>
        )}
        {results && results.claims.length > 0 && (
          <ResultGroup label="Claims">
            {results.claims.map((c) => (
              <ResultRow key={c.id} title={c.text} sub={`From: ${c.inv.title}`} tint={c.inv.tint}
                onClick={() => { navigate('investigation', c.inv.key, 'Claims'); onClose(); }} />
            ))}
          </ResultGroup>
        )}
        {results && results.questions.length > 0 && (
          <ResultGroup label="Questions">
            {results.questions.map((c) => (
              <ResultRow key={c.id} title={c.text} sub={`From: ${c.inv.title}`} tint={c.inv.tint}
                onClick={() => { navigate('investigation', c.inv.key, 'Questions'); onClose(); }} />
            ))}
          </ResultGroup>
        )}
      </div>
    </Modal>
  );
}
function ResultGroup({ label, children }) {
  return (
    <div className="mb-1">
      <div className="px-5 py-1.5 text-[11px] uppercase tracking-wide text-[#666F87]">{label}</div>
      {children}
    </div>
  );
}
function ResultRow({ title, sub, tint, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.05] transition-colors text-left">
      <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: tint }} />
      <span className="min-w-0 flex-1">
        <div className="text-sm truncate">{title}</div>
        <div className="text-xs text-[#666F87] truncate">{sub}</div>
      </span>
    </button>
  );
}

/* ============================== Notifications panel ============================== */

function NotificationsPanel({ open, onClose, anchorRef }) {
  const { notifications, markNotifRead, markAllNotifRead } = useApp();
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-11 w-80 rounded-xl border border-white/10 bg-[#0A0A10] shadow-2xl z-50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <span className="text-sm font-medium">Notifications</span>
          <button onClick={markAllNotifRead} className="text-xs text-violet-300 hover:text-violet-200">Mark all read</button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 && <p className="px-4 py-6 text-sm text-[#666F87] text-center">You're all caught up.</p>}
          {notifications.map((n) => (
            <button key={n.id} onClick={() => markNotifRead(n.id)}
              className={`w-full text-left px-4 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.04] transition-colors flex items-start gap-2.5 ${!n.read ? 'bg-violet-500/[0.04]' : ''}`}>
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-none ${!n.read ? 'bg-violet-400' : 'bg-transparent'}`} />
              <span className="min-w-0">
                <div className="text-sm text-[#EDEFF6] leading-snug">{n.text}</div>
                <div className="text-xs text-[#666F87] mt-1">{n.time}</div>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ============================== Profile menu + Settings ============================== */

function ProfileMenu({ open, onClose, onOpenSettings, onLogout, direction = 'down' }) {
  const { user, navigate } = useApp();
  if (!open) return null;
  const posClass = direction === 'up' ? 'bottom-11' : 'top-11';
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`absolute right-0 ${posClass} w-56 rounded-xl border border-white/10 bg-[#0A0A10] shadow-2xl z-50 overflow-hidden`}>
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="text-sm font-medium truncate">{user.name}</div>
          <div className="text-xs text-[#666F87] truncate">{user.email}</div>
        </div>
        <button onClick={() => { onClose(); navigate('saved'); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#C7CCDC] hover:bg-white/[0.06] hover:text-white transition-colors">
          <Bookmark size={15} /> Saved items
        </button>
        <button onClick={() => { onClose(); onOpenSettings(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#C7CCDC] hover:bg-white/[0.06] hover:text-white transition-colors">
          <Settings size={15} /> Settings
        </button>
        <div className="h-px bg-white/[0.06]" />
        <button onClick={() => { onClose(); onLogout(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-colors">
          <LogOut size={15} /> Log out
        </button>
      </div>
    </>
  );
}

function SettingsModal({ open, onClose }) {
  const { user, updateUser } = useApp();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (open) { setName(user.name); setEmail(user.email); setSaved(false); } }, [open, user]);

  const save = () => {
    updateUser({ name: name.trim() || user.name, email: email.trim() || user.email });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title="Settings" onClose={onClose} />
      <div className="px-6 py-5 flex flex-col gap-5">
        <div>
          <label className="text-xs text-[#8891A8] mb-1.5 block">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm outline-none focus:border-violet-400/40" />
        </div>
        <div>
          <label className="text-xs text-[#8891A8] mb-1.5 block">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm outline-none focus:border-violet-400/40" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-3">
          <div>
            <div className="text-sm">Email notifications</div>
            <div className="text-xs text-[#666F87] mt-0.5">Get notified about investigation progress.</div>
          </div>
          <button onClick={() => setEmailNotifs((v) => !v)}
            className={`w-10 h-6 rounded-full relative transition-colors flex-none ${emailNotifs ? 'bg-gradient-to-r from-violet-600 to-blue-500' : 'bg-white/10'}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${emailNotifs ? 'left-5' : 'left-1'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-3">
          <div>
            <div className="text-sm">Appearance</div>
            <div className="text-xs text-[#666F87] mt-0.5">LENS is currently only available in dark mode.</div>
          </div>
          <Pill label="Dark" color="#C7CCDC" bg="rgba(255,255,255,0.06)" />
        </div>

        <PrimaryButton onClick={save} icon={Check}>{saved ? 'Saved!' : 'Save changes'}</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ============================== New Investigation modal ============================== */

function NewInvestigationModal({ open, onClose, initialTitle = '' }) {
  const { createInvestigation } = useApp();
  const [title, setTitle] = useState(initialTitle);
  useEffect(() => { if (open) setTitle(initialTitle); }, [open, initialTitle]);

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    createInvestigation(title.trim());
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title="New Investigation" onClose={onClose} />
      <form onSubmit={submit} className="px-6 py-5 flex flex-col gap-4">
        <div>
          <label className="text-xs text-[#8891A8] mb-1.5 block">What do you want to understand?</label>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The History of the Silk Road"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm outline-none focus:border-violet-400/40" />
        </div>
        <PrimaryButton type="submit" icon={Sparkles} disabled={!title.trim()}>Start investigation</PrimaryButton>
      </form>
    </Modal>
  );
}

/* ============================== Add Source modal ============================== */

function AddSourceModal({ open, onClose, investigationKey, defaultType = 'URL' }) {
  const { addSource } = useApp();
  const [type, setType] = useState(defaultType);
  const [value, setValue] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');

  useEffect(() => { if (open) { setType(defaultType); setValue(''); setTitle(''); setFile(null); setFileError(''); } }, [open, defaultType]);

  const onFilePick = (e) => {
    const f = e.target.files?.[0];
    setFileError('');
    if (!f) { setFile(null); return; }
    if (f.type !== 'application/pdf') { setFile(null); setFileError('Please choose a PDF file.'); return; }
    if (f.size > 15 * 1024 * 1024) { setFile(null); setFileError('That PDF is over the 15MB limit.'); return; }
    setFile(f);
  };

  const typeMeta = CHIPS.find((c) => c.key === type) || CHIPS[0];

  const submit = (e) => {
    e.preventDefault();
    if (type === 'PDF') {
      if (!file) return;
    } else if (!value.trim()) {
      return;
    }
    let domain = 'source.local';
    if (type === 'PDF') {
      domain = 'uploaded file';
    } else {
      try {
        if (type === 'URL' || type === 'YouTube') domain = new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace('www.', '');
        else domain = 'uploaded file';
      } catch {
        domain = value.split('/')[0];
      }
    }
    const iconByType = { URL: 'ExternalLink', PDF: 'FileText', YouTube: 'Video', 'Research Paper': 'FileText' };
    const tintByType = { URL: '#38BDF8', PDF: '#2DD4BF', YouTube: '#F43F5E', 'Research Paper': '#818CF8' };
    addSource({
      title: title.trim() || (type === 'PDF' ? file.name.replace(/\.pdf$/i, '') : value.trim().slice(0, 60)),
      domain,
      type,
      value: type === 'PDF' ? '' : value.trim(),
      icon: iconByType[type],
      tint: tintByType[type],
      added: 'Just now',
    }, investigationKey, type === 'PDF' ? file : undefined);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title="Add Source" onClose={onClose} />
      <div className="px-6 pt-4">
        <div className="grid grid-cols-4 gap-2 mb-5">
          {CHIPS.map((c) => (
            <button key={c.key} type="button" onClick={() => setType(c.key)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 px-1 transition-colors ${
                type === c.key ? 'border-white/20 bg-white/[0.06]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
              }`}>
              <c.icon size={17} color={c.color} />
              <span className="text-[10px] text-center leading-tight" style={{ color: c.color }}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
      <form onSubmit={submit} className="px-6 pb-6 flex flex-col gap-4">
        {type === 'PDF' ? (
          <div>
            <label className="text-xs text-[#8891A8] mb-1.5 block">PDF file</label>
            <label className="flex items-center gap-2.5 w-full rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-3.5 py-3 text-sm text-[#8891A8] hover:border-white/25 cursor-pointer transition-colors">
              <FileText size={15} className="flex-none" />
              <span className="flex-1 truncate">{file ? file.name : 'Choose a PDF (max 15MB)…'}</span>
              <input type="file" accept="application/pdf" onChange={onFilePick} className="hidden" />
            </label>
            {fileError && <p className="text-xs text-rose-300 mt-1.5">{fileError}</p>}
          </div>
        ) : (
          <div>
            <label className="text-xs text-[#8891A8] mb-1.5 block">
              {type === 'YouTube' ? 'YouTube URL' : type === 'Research Paper' ? 'Paper URL or DOI' : 'URL'}
            </label>
            <input autoFocus value={value} onChange={(e) => setValue(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm outline-none focus:border-violet-400/40" />
          </div>
        )}
        <div>
          <label className="text-xs text-[#8891A8] mb-1.5 block">Title <span className="text-[#666F87]">(optional)</span></label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give this source a name"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm outline-none focus:border-violet-400/40" />
        </div>
        <PrimaryButton type="submit" icon={typeMeta.icon} disabled={type === 'PDF' ? !file : !value.trim()}>Add {type}</PrimaryButton>
      </form>
    </Modal>
  );
}

/* ============================== Concept detail panel (used in Knowledge Map) ============================== */

function ConceptPanel({ concept, tint, onSave, onClose }) {
  if (!concept) return null;
  return (
    <div className="absolute top-4 right-4 w-72 rounded-xl border border-white/10 bg-[#0A0A10]/95 backdrop-blur-md shadow-2xl p-4 z-10">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: tint }} />
          <h4 className="text-sm font-medium truncate">{concept.label}</h4>
        </div>
        <button onClick={onClose} className="text-[#666F87] hover:text-white flex-none"><X size={14} /></button>
      </div>
      <p className="text-xs text-[#8891A8] leading-relaxed mb-3">{concept.desc}</p>
      <SaveToggleLabeled saved={concept.saved} onClick={onSave} />
    </div>
  );
}
function SaveToggleLabeled({ saved, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        saved ? 'bg-violet-500/15 border border-violet-400/40 text-violet-300' : 'border border-white/10 text-[#C7CCDC] hover:text-white hover:bg-white/[0.06]'
      }`}>
      <Bookmark size={13} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save concept'}
    </button>
  );
}

/* ============================== Interactive Knowledge Map ============================== */

function KnowledgeMap({ concepts, edges, tint, onToggleSaveConcept, height = 'h-[480px]' }) {
  const containerRef = useRef(null);
  const [positions, setPositions] = useState(() => concepts.map((c) => ({ x: c.x, y: c.y })));
  const [dragging, setDragging] = useState(null); // {i, moved}
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => { setPositions(concepts.map((c) => ({ x: c.x, y: c.y }))); }, [concepts.length]);

  const toContainerPct = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const onNodeDown = (i, e) => {
    e.stopPropagation();
    setDragging({ i, moved: false, startX: e.clientX, startY: e.clientY });
  };

  const onMove = useCallback((e) => {
    if (!dragging || !containerRef.current) return;
    const pt = toContainerPct(e.clientX, e.clientY);
    const nx = Math.min(96, Math.max(4, pt.x));
    const ny = Math.min(96, Math.max(4, pt.y));
    setPositions((prev) => {
      const next = [...prev];
      next[dragging.i] = { x: nx, y: ny };
      return next;
    });
    const moved = Math.abs(e.clientX - dragging.startX) > 4 || Math.abs(e.clientY - dragging.startY) > 4;
    if (moved && !dragging.moved) setDragging((d) => ({ ...d, moved: true }));
  }, [dragging]);

  const onUp = useCallback(() => {
    if (dragging && !dragging.moved) {
      setSelected(dragging.i);
    }
    setDragging(null);
  }, [dragging]);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, onMove, onUp]);

  const onWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(2.4, Math.max(0.5, z + (e.deltaY < 0 ? 0.1 : -0.1))));
  };

  const selectedConcept = selected != null ? concepts[selected] : null;

  return (
    <div className={`relative w-full ${height} rounded-2xl border border-white/[0.07] bg-[#0A0A10]/70 overflow-hidden`}>
      <div
        ref={containerRef}
        onWheel={onWheel}
        onMouseDown={() => setSelected(null)}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      >
        <div className="absolute inset-0 origin-center transition-transform duration-150" style={{ transform: `scale(${zoom})` }}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
            {edges.map(([a, b], i) => {
              const pa = positions[a], pb = positions[b];
              if (!pa || !pb) return null;
              return (
                <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  stroke={tint} strokeOpacity="0.4" strokeWidth="0.35" className="flow-line" />
              );
            })}
          </svg>
          {concepts.map((c, i) => {
            const pos = positions[i] || { x: c.x, y: c.y };
            const isSel = selected === i;
            return (
              <div key={c.id} onMouseDown={(e) => onNodeDown(i, e)}
                className="absolute select-none cursor-pointer"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)' }}>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="rounded-full flex items-center justify-center transition-all"
                    style={{
                      width: isSel ? 20 : 14, height: isSel ? 20 : 14,
                      background: tint,
                      boxShadow: isSel ? `0 0 0 6px ${tint}33, 0 0 24px ${tint}88` : `0 0 10px ${tint}66`,
                    }} />
                  <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-[#050507]/80 border border-white/10 whitespace-nowrap" style={{ color: tint }}>
                    {c.label}
                  </span>
                  {c.saved && <Bookmark size={10} className="text-violet-300 -mt-1" fill="currentColor" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg border border-white/10 bg-[#0A0A10]/90 backdrop-blur-md p-1">
        <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))} className="w-7 h-7 rounded-md flex items-center justify-center text-[#8891A8] hover:text-white hover:bg-white/[0.06]"><ZoomOut size={14} /></button>
        <span className="text-[11px] text-[#8891A8] w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(2.4, z + 0.15))} className="w-7 h-7 rounded-md flex items-center justify-center text-[#8891A8] hover:text-white hover:bg-white/[0.06]"><ZoomIn size={14} /></button>
        <div className="w-px h-4 bg-white/10 mx-0.5" />
        <button onClick={() => setZoom(1)} className="w-7 h-7 rounded-md flex items-center justify-center text-[#8891A8] hover:text-white hover:bg-white/[0.06]"><RotateCcw size={13} /></button>
      </div>
      <div className="absolute bottom-3 right-3 text-[11px] text-[#666F87] flex items-center gap-1.5">
        <Maximize2 size={11} /> Drag nodes {'\u00b7'} scroll to zoom
      </div>

      <ConceptPanel concept={selectedConcept} tint={tint}
        onSave={() => onToggleSaveConcept(selectedConcept.id)}
        onClose={() => setSelected(null)} />
    </div>
  );
}

/* ============================== Map viewer modal (from Maps page) ============================== */

function MapViewerModal({ open, onClose, map }) {
  const { toggleConceptSaved, toggleMapSaved } = useApp();
  if (!open || !map) return null;
  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-4xl">
      <ModalHeader title={map.title} onClose={onClose} />
      <div className="px-6 pt-1 pb-2 flex items-center justify-between">
        <p className="text-sm text-[#8891A8]">From: {map.from}</p>
        <div className="flex items-center gap-2">
          <Pill label={map.visibility} {...VISIBILITY_STYLES[map.visibility]} />
          <SaveToggle saved={map.saved} onClick={() => toggleMapSaved(map.invKey)} />
        </div>
      </div>
      <div className="px-6 pb-6">
        <KnowledgeMap concepts={map.concepts} edges={map.edges} tint={map.tint}
          onToggleSaveConcept={(id) => toggleConceptSaved(map.invKey, id)} height="h-[440px]" />
      </div>
    </Modal>
  );
}

/* ============================== Share modal ============================== */

function ShareModal({ open, onClose, title, subtitle }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (open) setCopied(false); }, [open]);
  if (!open) return null;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = title ? `Check out my investigation "${title}" on LENS` : 'Check out this investigation on LENS';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — user can still select the field manually */
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
  const handleNativeShare = async () => {
    try { await navigator.share({ title: shareText, text: shareText, url: shareUrl }); } catch { /* user cancelled */ }
  };

  const channels = [
    {
      label: 'WhatsApp', color: '#25D366', icon: MessageCircle,
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
    },
    {
      label: 'Gmail', color: '#EA4335', icon: Mail,
      href: `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'Email', color: '#8891A8', icon: Mail,
      href: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'X', color: '#EDEFF6', glyph: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'LinkedIn', color: '#0A66C2', glyph: 'in',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
  ];

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md">
      <ModalHeader title="Share investigation" onClose={onClose} />
      <div className="px-6 py-5">
        {subtitle && <p className="text-sm text-[#8891A8] mb-5 -mt-1">{subtitle}</p>}

        <div className="grid grid-cols-5 gap-3 mb-6">
          {channels.map((c) => (
            <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 group">
              <span className="w-11 h-11 rounded-full flex items-center justify-center border border-white/10 bg-white/[0.03] group-hover:bg-white/[0.08] group-hover:border-white/20 transition-colors" style={{ color: c.color }}>
                {c.icon ? <c.icon size={18} /> : <span className="text-[13px] font-bold font-display">{c.glyph}</span>}
              </span>
              <span className="text-[10.5px] text-[#8891A8] group-hover:text-white transition-colors">{c.label}</span>
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <Link2 size={14} className="text-[#666F87] flex-none" />
          <input readOnly value={shareUrl} onFocus={(e) => e.target.select()}
            className="flex-1 min-w-0 bg-transparent text-xs text-[#C7CCDC] outline-none truncate" />
          <button onClick={handleCopy}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors flex-none ${
              copied ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gradient-to-r from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white'
            }`}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {canNativeShare && (
          <button onClick={handleNativeShare}
            className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg border border-white/10 py-2.5 text-sm text-[#C7CCDC] hover:text-white hover:bg-white/[0.06] transition-colors">
            <Share2 size={14} /> More sharing options
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ============================== Home view ============================== */

function HomeView() {
  const { investigations, navigate, createInvestigation } = useApp();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');

  const recent = useMemo(
    () => investigations.filter((i) => !i.trashed).slice().sort((a, b) => a.updated.localeCompare(b.updated)).slice(0, 3),
    [investigations]
  );

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    createInvestigation(text.trim());
    setText('');
  };

  return (
    <div className="px-6 md:px-10 py-10 flex flex-col items-center gap-16">
      <div className="relative w-full max-w-5xl h-[440px] md:h-[500px]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none opacity-60">
          <g className="orbit-ring">
            <ellipse cx="50" cy="50" rx="43" ry="34" fill="none" stroke="rgba(129,140,248,0.18)" strokeWidth="0.3" strokeDasharray="1.2 2.2" />
            <ellipse cx="50" cy="50" rx="30" ry="23" fill="none" stroke="rgba(56,189,248,0.15)" strokeWidth="0.3" strokeDasharray="1 2" />
          </g>
        </svg>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
          {CHIPS.map((c) => {
            const [lx, ly] = [parseFloat(c.pos.left), parseFloat(c.pos.top)];
            const mx = (lx + 50) / 2, my = (ly + 50) / 2 + (ly < 50 ? 6 : -6);
            return <path key={c.key} d={`M ${lx} ${ly} Q ${mx} ${my} 50 50`} fill="none" stroke={c.color} strokeOpacity="0.28" strokeWidth="0.3" className="flow-line" />;
          })}
        </svg>
        {[...Array(14)].map((_, i) => (
          <span key={i} className="particle" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${(i % 7) * 0.4}s` }} />
        ))}
        {CHIPS.map((c) => (
          <div key={c.key} className={`chip ${focused ? 'active' : ''}`}
            style={{ left: c.pos.left, top: c.pos.top, '--px': `${c.pull.x}px`, '--py': `${c.pull.y}px` }}
            onClick={() => setFocused(true)}>
            <div className="chip-float" style={{ animationDelay: c.delay }}>
              <div className="flex flex-col items-center justify-center gap-1.5 w-[76px] h-[76px] rounded-2xl border backdrop-blur-md cursor-pointer"
                style={{ borderColor: `${c.color}55`, background: 'rgba(10,10,16,0.6)', boxShadow: focused ? `0 0 26px ${c.color}55` : `0 0 14px ${c.color}22` }}>
                <c.icon size={20} color={c.color} />
                <span className="text-[10px] text-center leading-tight px-1" style={{ color: c.color }}>{c.label}</span>
              </div>
            </div>
          </div>
        ))}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10">
          <h1 className="font-display font-bold text-4xl md:text-5xl leading-tight">
            What do you want<br />to <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">understand?</span>
          </h1>
          <p className="text-[#8891A8] mt-4 max-w-md text-sm md:text-base">Add sources from anywhere and let LENS turn information into clarity.</p>

          <form onSubmit={submit}
            className={`glow-input ${focused ? 'on' : ''} mt-8 w-full max-w-xl flex items-center gap-3 rounded-full border border-white/10 bg-[#0A0A10]/90 px-5 py-3.5`}
            onMouseEnter={() => setFocused(true)} onMouseLeave={() => setFocused(false)}>
            <Sparkles size={17} className="text-violet-400 flex-none" />
            <input type="text" value={text} onChange={(e) => setText(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              placeholder="Paste a URL, upload PDF, YouTube video, or describe a topic…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#666F87]" />
            <button type="submit" disabled={!text.trim()}
              className="w-9 h-9 flex-none rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-40">
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="flex items-center gap-2.5 mt-6 text-xs text-[#8891A8]">
            <div className="flex -space-x-2">
              {['#A78BFA', '#38BDF8', '#F472B6'].map((c, i) => <div key={i} className="w-6 h-6 rounded-full border-2 border-[#050507]" style={{ background: c }} />)}
            </div>
            <span><span className="text-violet-300 font-medium">1.2K+</span> researchers are exploring with LENS</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-6xl">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="font-display font-semibold text-lg">Continue Exploring</h2>
            <p className="text-sm text-[#8891A8] mt-0.5">Pick up where you left off</p>
          </div>
          <button onClick={() => navigate('investigations')} className="text-sm text-violet-300 hover:text-violet-200 flex items-center gap-1 transition-colors">
            View all <ArrowRight size={14} />
          </button>
        </div>

        {recent.length === 0 ? (
          <EmptyState icon={Sparkles} title="No investigations yet" subtitle="Start one above to see it here." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {recent.map((card) => (
              <button key={card.key} onClick={() => navigate('investigation', card.key)} className="text-left group rounded-2xl border border-white/[0.07] bg-[#0A0A10]/70 p-5 hover:border-white/[0.14] hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                    <Icon name={card.icon} size={18} color={card.tint} />
                  </div>
                  <MoreHorizontal size={16} className="text-[#666F87]" />
                </div>
                <MiniGraph nodes={card.concepts.map((c) => [c.x, c.y])} edges={card.edges} tint={card.tint} />
                <h3 className="font-medium text-[15px] mt-2">{card.title}</h3>
                <div className="flex items-center gap-3 text-xs text-[#8891A8] mt-2">
                  <span className="flex items-center gap-1"><Database size={12} /> {card.baseSourceCount} Sources</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> Updated {card.updated}</span>
                </div>
                <div className="mt-4"><ProgressBar percent={card.percent} tint={card.tint} /></div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== My Investigations view ============================== */

function InvestigationsView() {
  const { investigations, navigate, sources } = useApp();
  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');
  const [openNew, setOpenNew] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const { trashInvestigation } = useApp();

  const filtered = useMemo(() => {
    let list = investigations.filter((i) => !i.trashed);
    if (tab === 'Shared') list = list.filter((i) => i.visibility === 'Shared');
    else if (tab !== 'All') list = list.filter((i) => i.status === tab);
    if (q.trim()) list = list.filter((i) => i.title.toLowerCase().includes(q.trim().toLowerCase()));
    return list;
  }, [investigations, tab, q]);

  return (
    <div className="px-6 md:px-10 py-8">
      <PageHeader title="My Investigations" subtitle="All the topics you've explored with LENS."
        search="Search investigations…" searchValue={q} onSearchChange={setQ}
        actions={<PrimaryButton icon={Plus} onClick={() => setOpenNew(true)}>New Investigation</PrimaryButton>} />

      <div className="flex items-center justify-between mb-6">
        <FilterTabs tabs={INVESTIGATION_FILTER_TABS} active={tab} onChange={setTab} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No investigations found" subtitle="Try a different filter or search term." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {filtered.map((card) => {
            const linkedCount = sources.filter((s) => s.usedIn.includes(card.key)).length;
            return (
              <div key={card.key}
                className="relative group rounded-2xl border border-white/[0.07] bg-[#0A0A10]/70 p-5 hover:border-white/[0.14] hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                onClick={() => navigate('investigation', card.key)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                    <Icon name={card.icon} size={18} color={card.tint} />
                  </div>
                  <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === card.key ? null : card.key); }}
                      className="text-[#666F87] hover:text-white"><MoreHorizontal size={16} /></button>
                    {menuFor === card.key && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }} />
                        <div className="absolute right-0 mt-1 w-36 rounded-lg border border-white/10 bg-[#0A0A10] shadow-2xl z-30 overflow-hidden">
                          <button onClick={(e) => { e.stopPropagation(); navigate('investigation', card.key); setMenuFor(null); }}
                            className="w-full text-left px-3 py-2 text-sm text-[#C7CCDC] hover:bg-white/[0.06] hover:text-white">Open</button>
                          <button onClick={(e) => { e.stopPropagation(); trashInvestigation(card.key); setMenuFor(null); }}
                            className="w-full text-left px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10">Move to Trash</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <MiniGraph nodes={card.concepts.map((c) => [c.x, c.y])} edges={card.edges} tint={card.tint} />
                <h3 className="font-medium text-[15px] mt-2">{card.title}</h3>
                <div className="flex items-center gap-3 text-xs text-[#8891A8] mt-2">
                  <span className="flex items-center gap-1"><Database size={12} /> {card.baseSourceCount + linkedCount} Sources</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> Updated {card.updated}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Pill label={card.status} color={card.tint} bg={card.bg} />
                  {card.visibility === 'Shared' && <Pill label="Shared" {...VISIBILITY_STYLES.Shared} />}
                </div>
                <div className="mt-4"><ProgressBar percent={card.percent} tint={card.tint} /></div>
              </div>
            );
          })}
        </div>
      )}

      <NewInvestigationModal open={openNew} onClose={() => setOpenNew(false)} />
    </div>
  );
}

/* ============================== Sources view ============================== */

function SourcesView() {
  const { sources, deleteSource, investigations, navigate } = useApp();
  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');
  const [openAdd, setOpenAdd] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const { toggleSourceSaved } = useApp();

  const filtered = useMemo(() => {
    let list = sources;
    if (tab !== 'All') list = list.filter((s) => s.type === tab);
    if (q.trim()) list = list.filter((s) => s.title.toLowerCase().includes(q.trim().toLowerCase()) || s.domain.toLowerCase().includes(q.trim().toLowerCase()));
    return list;
  }, [sources, tab, q]);

  const titleFor = (s) => investigations.find((i) => i.key === s.usedIn[0])?.title;

  return (
    <div className="px-6 md:px-10 py-8">
      <PageHeader title="Sources" subtitle="All the content you've added to LENS."
        search="Search sources…" searchValue={q} onSearchChange={setQ}
        actions={<PrimaryButton icon={Plus} onClick={() => setOpenAdd(true)}>Add Source</PrimaryButton>} />

      <div className="flex items-center justify-between mb-6">
        <FilterTabs tabs={SOURCE_TYPE_TABS} active={tab} onChange={setTab} />
        <SortDropdown label="All Time" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Database} title="No sources found" subtitle="Add a source or try a different filter." action={<PrimaryButton icon={Plus} onClick={() => setOpenAdd(true)}>Add Source</PrimaryButton>} />
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0A0A10]/70 overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_110px_110px_36px] gap-4 px-5 py-3 text-[11px] uppercase tracking-wide text-[#666F87] border-b border-white/[0.06]">
            <span>Source</span><span>Type</span><span>Added On</span><span>Used In</span><span />
          </div>
          {filtered.map((s) => (
            <div key={s.key} className="grid grid-cols-[1fr_140px_110px_110px_36px] gap-4 px-5 py-3.5 items-center border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: `${s.tint}22` }}>
                  <Icon name={s.icon} size={15} color={s.tint} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    {s.title} {s.saved && <Bookmark size={11} className="text-violet-300 flex-none" fill="currentColor" />}
                  </div>
                  <div className="text-xs text-[#8891A8] truncate">{s.domain}{titleFor(s) ? ` \u00b7 used in ${titleFor(s)}` : ''}</div>
                </div>
              </div>
              <div><Pill label={s.type} {...(SOURCE_TYPE_STYLES[s.type] || SOURCE_TYPE_STYLES.URL)} /></div>
              <span className="text-xs text-[#8891A8]">{s.added}</span>
              <span className="text-xs text-[#8891A8]">{s.usedIn.length} investigation{s.usedIn.length === 1 ? '' : 's'}</span>
              <div className="relative justify-self-end">
                <button onClick={() => setMenuFor(menuFor === s.key ? null : s.key)} className="text-[#666F87] hover:text-white"><MoreHorizontal size={16} /></button>
                {menuFor === s.key && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuFor(null)} />
                    <div className="absolute right-0 mt-1 w-40 rounded-lg border border-white/10 bg-[#0A0A10] shadow-2xl z-30 overflow-hidden">
                      <button onClick={() => { toggleSourceSaved(s.key); setMenuFor(null); }} className="w-full text-left px-3 py-2 text-sm text-[#C7CCDC] hover:bg-white/[0.06] hover:text-white">{s.saved ? 'Unsave' : 'Save'}</button>
                      {s.usedIn[0] && <button onClick={() => { navigate('investigation', s.usedIn[0], 'Sources'); setMenuFor(null); }} className="w-full text-left px-3 py-2 text-sm text-[#C7CCDC] hover:bg-white/[0.06] hover:text-white">Open</button>}
                      <button onClick={() => { deleteSource(s.key); setMenuFor(null); }} className="w-full text-left px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10">Delete</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddSourceModal open={openAdd} onClose={() => setOpenAdd(false)} investigationKey={null} />
    </div>
  );
}

/* ============================== Maps view ============================== */

function MapsView() {
  const { maps } = useApp();
  const [tab, setTab] = useState('All');
  const [view, setView] = useState('grid');
  const [q, setQ] = useState('');
  const [openMap, setOpenMap] = useState(null);

  const filtered = useMemo(() => {
    let list = maps;
    if (tab === 'Shared with me') list = list.filter((m) => m.visibility === 'Shared');
    else if (tab !== 'All') list = list.filter((m) => m.visibility === tab);
    if (q.trim()) list = list.filter((m) => m.title.toLowerCase().includes(q.trim().toLowerCase()));
    return list;
  }, [maps, tab, q]);

  return (
    <div className="px-6 md:px-10 py-8">
      <PageHeader title="Maps" subtitle="Knowledge maps created from your investigations."
        search="Search maps…" searchValue={q} onSearchChange={setQ} />

      <div className="flex items-center justify-between mb-6">
        <FilterTabs tabs={MAP_FILTER_TABS} active={tab} onChange={setTab} />
        <div className="flex items-center gap-2.5">
          <SortDropdown />
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
            <button onClick={() => setView('grid')} className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${view === 'grid' ? 'bg-white/10 text-white' : 'text-[#8891A8] hover:text-white'}`}><LayoutGrid size={14} /></button>
            <button onClick={() => setView('list')} className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${view === 'list' ? 'bg-white/10 text-white' : 'text-[#8891A8] hover:text-white'}`}><List size={14} /></button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Network} title="No maps found" subtitle="Maps are generated automatically as you build investigations." />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-3 gap-5' : 'flex flex-col gap-3'}>
          {filtered.map((m) => (
            <div key={m.key} onClick={() => setOpenMap(m)}
              className={view === 'grid'
                ? 'group rounded-2xl border border-white/[0.07] bg-[#0A0A10]/70 p-5 hover:border-white/[0.14] hover:-translate-y-1 transition-all duration-300 cursor-pointer'
                : 'group rounded-xl border border-white/[0.07] bg-[#0A0A10]/70 p-4 flex items-center gap-4 hover:border-white/[0.14] transition-colors cursor-pointer'}>
              <div className={view === 'grid' ? 'rounded-xl overflow-hidden bg-white/[0.02] mb-3' : 'w-28 h-16 flex-none rounded-lg overflow-hidden bg-white/[0.02]'}>
                <MiniGraph nodes={m.concepts.map((c) => [c.x, c.y])} edges={m.edges} tint={m.tint} height={view === 'grid' ? 'h-28' : 'h-16'} />
              </div>
              <div className={view === 'list' ? 'flex-1 min-w-0' : ''}>
                <h3 className="font-medium text-[15px] truncate flex items-center gap-1.5">{m.title} {m.saved && <Bookmark size={11} className="text-violet-300 flex-none" fill="currentColor" />}</h3>
                <p className="text-xs text-[#8891A8] mt-1 truncate">From: {m.from}</p>
                <div className="flex items-center gap-2 mt-2.5">
                  <Pill label={m.visibility} {...VISIBILITY_STYLES[m.visibility]} />
                  {m.visibility !== 'Public' && <Share2 size={13} className="text-[#666F87]" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <MapViewerModal open={!!openMap} onClose={() => setOpenMap(null)} map={openMap} />
    </div>
  );
}

/* ============================== Saved view ============================== */

function SavedView() {
  const { investigations, sources, maps, navigate, toggleConceptSaved, toggleClaimSaved, toggleQuestionSaved, toggleSourceSaved, toggleMapSaved } = useApp();
  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');
  const [openMap, setOpenMap] = useState(null);

  const savedGroups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const matches = (t) => !query || t.toLowerCase().includes(query);
    const Concepts = [];
    const Claims = [];
    const Questions = [];
    investigations.filter((i) => !i.trashed).forEach((inv) => {
      inv.concepts.forEach((c) => { if (c.saved && matches(c.label)) Concepts.push({ key: c.id, title: c.label, from: inv.title, saved: 'saved', invKey: inv.key, conceptId: c.id }); });
      inv.claims.forEach((c) => { if (c.saved && matches(c.text)) Claims.push({ key: c.id, title: c.text, from: inv.title, saved: 'saved', invKey: inv.key, claimId: c.id }); });
      inv.questions.forEach((c) => { if (c.saved && matches(c.text)) Questions.push({ key: c.id, title: c.text, from: inv.title, saved: 'saved', invKey: inv.key, questionId: c.id }); });
    });
    const Sources = sources.filter((s) => s.saved && matches(s.title)).map((s) => ({ key: s.key, title: s.title, from: s.domain, saved: 'saved', sourceKey: s.key }));
    const Maps = maps.filter((m) => m.saved && matches(m.title)).map((m) => ({ key: m.key, title: m.title, from: m.from, saved: 'saved', mapObj: m }));
    const all = { Concepts, Claims, Sources, Questions, Maps };
    const entries = Object.entries(all).filter(([, items]) => items.length > 0);
    if (tab === 'All') return entries;
    return entries.filter(([group]) => group === tab);
  }, [investigations, sources, maps, tab, q]);

  const onOpen = (group, item) => {
    if (group === 'Concepts') navigate('investigation', item.invKey, 'Map');
    else if (group === 'Claims') navigate('investigation', item.invKey, 'Claims');
    else if (group === 'Questions') navigate('investigation', item.invKey, 'Questions');
    else if (group === 'Sources') navigate('sources');
    else if (group === 'Maps') setOpenMap(item.mapObj);
  };
  const onUnsave = (group, item) => {
    if (group === 'Concepts') toggleConceptSaved(item.invKey, item.conceptId);
    else if (group === 'Claims') toggleClaimSaved(item.invKey, item.claimId);
    else if (group === 'Questions') toggleQuestionSaved(item.invKey, item.questionId);
    else if (group === 'Sources') toggleSourceSaved(item.sourceKey);
    else if (group === 'Maps') toggleMapSaved(item.mapObj.invKey);
  };

  const hasAny = savedGroups.length > 0;

  return (
    <div className="px-6 md:px-10 py-8">
      <PageHeader title="Saved" subtitle="Saved items from across your investigations." search="Search saved items…" searchValue={q} onSearchChange={setQ} />
      <div className="mb-7"><FilterTabs tabs={SAVED_FILTER_TABS} active={tab} onChange={setTab} /></div>

      {!hasAny ? (
        <EmptyState icon={Bookmark} title="Nothing saved yet" subtitle="Save concepts, claims, questions, sources, or maps and they'll show up here." />
      ) : (
        <div className="flex flex-col gap-8">
          {savedGroups.map(([group, items]) => (
            <div key={group}>
              <h2 className="text-[11px] uppercase tracking-wide text-[#666F87] mb-3">{group}</h2>
              <div className="rounded-2xl border border-white/[0.07] bg-[#0A0A10]/70 overflow-hidden">
                {items.map((it) => (
                  <div key={it.key} onClick={() => onOpen(group, it)}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: `${SAVED_TYPE_STYLES[group].color}22` }}>
                        <Bookmark size={14} color={SAVED_TYPE_STYLES[group].color} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{it.title}</div>
                        <div className="text-xs text-[#8891A8] truncate">From: {it.from}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-none">
                      <Pill label={SAVED_TYPE_STYLES[group].label} color={SAVED_TYPE_STYLES[group].color} bg={SAVED_TYPE_STYLES[group].bg} />
                      <SaveToggle saved={true} onClick={() => onUnsave(group, it)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <MapViewerModal open={!!openMap} onClose={() => setOpenMap(null)} map={openMap} />
    </div>
  );
}

/* ============================== Investigation detail view ============================== */

function InvestigationDetailView({ invKey, initialTab }) {
  const { investigations, navigate, toggleConceptSaved, toggleClaimSaved, toggleQuestionSaved, toggleSourceSaved, toggleMapSaved, sources, deleteSource, unlinkSource } = useApp();
  const inv = investigations.find((i) => i.key === invKey);
  const [tab, setTab] = useState(initialTab || 'Overview');
  const [openAdd, setOpenAdd] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab, invKey]);

  if (!inv) {
    return (
      <div className="px-6 md:px-10 py-8">
        <EmptyState icon={FolderOpen} title="Investigation not found" subtitle="It may have been moved to trash." action={<GhostButton icon={ArrowLeft} onClick={() => navigate('investigations')}>Back to investigations</GhostButton>} />
      </div>
    );
  }

  const linkedSources = sources.filter((s) => s.usedIn.includes(inv.key));
  const savedConceptsCount = inv.concepts.filter((c) => c.saved).length;

  return (
    <div className="px-6 md:px-10 py-8">
      <button onClick={() => navigate('investigations')} className="flex items-center gap-1.5 text-xs text-[#8891A8] hover:text-white mb-5 transition-colors">
        <ArrowLeft size={13} /> My Investigations
      </button>

      <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-none" style={{ background: inv.bg }}>
            <Icon name={inv.icon} size={22} color={inv.tint} />
          </div>
          <div>
            <h1 className="font-display font-semibold text-2xl">{inv.title}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <Pill label={inv.status} color={inv.tint} bg={inv.bg} />
              <Pill label={inv.visibility} {...VISIBILITY_STYLES[inv.visibility]} />
              <span className="text-xs text-[#666F87] flex items-center gap-1"><Clock size={11} /> Updated {inv.updated}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <GhostButton icon={Share2} onClick={() => setShareOpen(true)}>Share</GhostButton>
          <SaveToggle saved={inv.mapSaved} onClick={() => toggleMapSaved(inv.key)} size={15} />
        </div>
      </div>

      <div className="mb-6"><ProgressBar percent={inv.percent} tint={inv.tint} /></div>

      <div className="mb-7"><FilterTabs tabs={INVESTIGATION_TABS} active={tab} onChange={setTab} /></div>

      {tab === 'Overview' && (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Database} label="Sources" value={inv.baseSourceCount + linkedSources.length} tint={inv.tint} />
            <StatCard icon={Network} label="Concepts mapped" value={inv.concepts.length} tint={inv.tint} />
            <StatCard icon={Bookmark} label="Saved items" value={savedConceptsCount + inv.claims.filter((c) => c.saved).length + inv.questions.filter((c) => c.saved).length} tint={inv.tint} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-base">Key Concepts</h2>
              <button onClick={() => setTab('Map')} className="text-xs text-violet-300 hover:text-violet-200 flex items-center gap-1">Open map <ArrowRight size={12} /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {inv.concepts.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] pl-3 pr-1.5 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: inv.tint }} />
                  <span className="text-xs">{c.label}</span>
                  <SaveToggle saved={c.saved} onClick={() => toggleConceptSaved(inv.key, c.id)} size={12} />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold text-base">Top Claims</h2>
                <button onClick={() => setTab('Claims')} className="text-xs text-violet-300 hover:text-violet-200">View all</button>
              </div>
              <div className="flex flex-col gap-2">
                {inv.claims.slice(0, 2).map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#0A0A10]/70 p-3.5">
                    <p className="text-sm leading-snug">{c.text}</p>
                    <SaveToggle saved={c.saved} onClick={() => toggleClaimSaved(inv.key, c.id)} />
                  </div>
                ))}
                {inv.claims.length === 0 && <p className="text-sm text-[#666F87]">No claims yet.</p>}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold text-base">Open Questions</h2>
                <button onClick={() => setTab('Questions')} className="text-xs text-violet-300 hover:text-violet-200">View all</button>
              </div>
              <div className="flex flex-col gap-2">
                {inv.questions.slice(0, 2).map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#0A0A10]/70 p-3.5">
                    <p className="text-sm leading-snug">{c.text}</p>
                    <SaveToggle saved={c.saved} onClick={() => toggleQuestionSaved(inv.key, c.id)} />
                  </div>
                ))}
                {inv.questions.length === 0 && <p className="text-sm text-[#666F87]">No questions yet.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Map' && (
        <KnowledgeMap concepts={inv.concepts} edges={inv.edges} tint={inv.tint}
          onToggleSaveConcept={(id) => toggleConceptSaved(inv.key, id)} />
      )}

      {tab === 'Sources' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#8891A8]">{linkedSources.length} source{linkedSources.length === 1 ? '' : 's'} linked to this investigation.</p>
            <PrimaryButton icon={Plus} onClick={() => setOpenAdd(true)}>Add Source</PrimaryButton>
          </div>
          {linkedSources.length === 0 ? (
            <EmptyState icon={Database} title="No sources linked yet" subtitle="Add a source to start building this investigation." action={<PrimaryButton icon={Plus} onClick={() => setOpenAdd(true)}>Add Source</PrimaryButton>} />
          ) : (
            <div className="rounded-2xl border border-white/[0.07] bg-[#0A0A10]/70 overflow-hidden">
              {linkedSources.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: `${s.tint}22` }}>
                      <Icon name={s.icon} size={15} color={s.tint} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.title}</div>
                      <div className="text-xs text-[#8891A8] truncate">{s.domain}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-none">
                    <Pill label={s.type} {...(SOURCE_TYPE_STYLES[s.type] || SOURCE_TYPE_STYLES.URL)} />
                    <SaveToggle saved={s.saved} onClick={() => toggleSourceSaved(s.key)} />
                    <button onClick={() => unlinkSource(s.key, inv.key)} className="text-[#666F87] hover:text-rose-300 transition-colors"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'Claims' && (
        <ClaimsOrQuestions kind="claims" items={inv.claims} tint={inv.tint} onToggle={(id) => toggleClaimSaved(inv.key, id)} icon={Quote} />
      )}
      {tab === 'Questions' && (
        <ClaimsOrQuestions kind="questions" items={inv.questions} tint={inv.tint} onToggle={(id) => toggleQuestionSaved(inv.key, id)} icon={MessageCircleQuestion} />
      )}

      <AddSourceModal open={openAdd} onClose={() => setOpenAdd(false)} investigationKey={inv.key} />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} title={inv.title} subtitle="Share a link to this investigation." />
    </div>
  );
}

function StatCard({ icon: IconCmp, label, value, tint }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0A0A10]/70 p-4 flex items-center gap-3.5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-none" style={{ background: `${tint}22` }}>
        <IconCmp size={17} color={tint} />
      </div>
      <div>
        <div className="text-lg font-display font-semibold">{value}</div>
        <div className="text-xs text-[#8891A8]">{label}</div>
      </div>
    </div>
  );
}

function ClaimsOrQuestions({ items, tint, onToggle, icon: IconCmp }) {
  if (items.length === 0) return <EmptyState icon={IconCmp} title="Nothing here yet" subtitle="These will populate as you explore more sources." />;
  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => (
        <div key={it.id} className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.07] bg-[#0A0A10]/70 p-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-none mt-0.5" style={{ background: `${tint}22` }}>
              <IconCmp size={14} color={tint} />
            </div>
            <p className="text-sm leading-relaxed">{it.text}</p>
          </div>
          <SaveToggle saved={it.saved} onClick={() => onToggle(it.id)} />
        </div>
      ))}
    </div>
  );
}

/* ============================== Page titles ============================== */

const PAGE_META = {
  home: null,
  investigations: { label: 'My Investigations' },
  sources: { label: 'Sources' },
  maps: { label: 'Maps' },
  saved: { label: 'Saved' },
  shared: { label: 'Shared with me' },
  trash: { label: 'Trash' },
  investigation: { label: 'Investigation' },
};

/* ============================== Root component ============================== */

export default function LensDashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [view, setView] = useState('home');
  const [activeInvKey, setActiveInvKey] = useState(null);
  const [activeInvTab, setActiveInvTab] = useState(null);

  const [investigations, setInvestigations] = useState([]);
  const [sources, setSources] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Restore a session from a saved token on first load, instead of
  // trusting a plain localStorage user object.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getToken();
      if (!token) { setAuthLoading(false); return; }
      try {
        const data = await api.get('/auth/me');
        if (!cancelled) setUser(data.user);
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Whenever the logged-in user changes, (re)load their investigations,
  // sources, and notifications from the backend.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) { setInvestigations([]); setSources([]); setNotifications([]); return; }
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      try {
        const [invData, srcData, notifData] = await Promise.all([
          api.get('/investigations'),
          api.get('/sources'),
          api.get('/notifications'),
        ]);
        if (!cancelled) {
          setInvestigations(invData.investigations);
          setSources(srcData.sources);
          setNotifications(notifData.notifications);
        }
      } catch (err) {
        if (!cancelled) setApiError(err.message);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Clear a surfaced error a few seconds after it appears.
  useEffect(() => {
    if (!apiError) return;
    const t = setTimeout(() => setApiError(''), 6000);
    return () => clearTimeout(t);
  }, [apiError]);

  const refreshNotifications = async () => {
    try {
      const data = await api.get('/notifications');
      setNotifications(data.notifications);
    } catch { /* non-critical, ignore */ }
  };

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newInvOpen, setNewInvOpen] = useState(false);

  // global cmd+k shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); }
      if (e.key === 'Escape') { setPaletteOpen(false); setNotifOpen(false); setProfileOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const navigate = (v, invKey = null, invTab = null) => {
    setView(v);
    setActiveInvKey(invKey);
    setActiveInvTab(invTab);
    window.scrollTo?.(0, 0);
  };

  /* ---- Investigations ---- */
  const createInvestigation = async (title) => {
    try {
      const data = await api.post('/investigations', { title });
      setInvestigations((prev) => [data.investigation, ...prev]);
      navigate('investigation', data.investigation.key);
      refreshNotifications();
    } catch (err) {
      setApiError(err.message);
    }
  };

  const trashInvestigation = async (key) => {
    const prevList = investigations;
    setInvestigations((prev) => prev.map((i) => (i.key === key ? { ...i, trashed: true } : i)));
    if (activeInvKey === key) navigate('investigations');
    try {
      await api.patch(`/investigations/${key}/trash`);
      refreshNotifications();
    } catch (err) {
      setInvestigations(prevList);
      setApiError(err.message);
    }
  };
  const restoreInvestigation = async (key) => {
    const prevList = investigations;
    setInvestigations((prev) => prev.map((i) => (i.key === key ? { ...i, trashed: false } : i)));
    try {
      await api.patch(`/investigations/${key}/restore`);
    } catch (err) {
      setInvestigations(prevList);
      setApiError(err.message);
    }
  };

  // Shared optimistic-toggle helper for concept/claim/question "saved" state:
  // flip it locally right away, call the API, and revert on failure.
  const toggleInvestigationItemSaved = (invKey, itemId, listKey, endpoint) => {
    setInvestigations((prev) => prev.map((i) => i.key !== invKey ? i : {
      ...i, [listKey]: i[listKey].map((c) => c.id === itemId ? { ...c, saved: !c.saved } : c),
    }));
    api.patch(`/investigations/${invKey}/${endpoint}/${itemId}/saved`).catch((err) => {
      setInvestigations((prev) => prev.map((i) => i.key !== invKey ? i : {
        ...i, [listKey]: i[listKey].map((c) => c.id === itemId ? { ...c, saved: !c.saved } : c),
      }));
      setApiError(err.message);
    });
  };
  const toggleConceptSaved = (invKey, conceptId) => toggleInvestigationItemSaved(invKey, conceptId, 'concepts', 'concepts');
  const toggleClaimSaved = (invKey, claimId) => toggleInvestigationItemSaved(invKey, claimId, 'claims', 'claims');
  const toggleQuestionSaved = (invKey, questionId) => toggleInvestigationItemSaved(invKey, questionId, 'questions', 'questions');

  const toggleMapSaved = (invKey) => {
    setInvestigations((prev) => prev.map((i) => i.key === invKey ? { ...i, mapSaved: !i.mapSaved } : i));
    api.patch(`/investigations/${invKey}/map-saved`).catch((err) => {
      setInvestigations((prev) => prev.map((i) => i.key === invKey ? { ...i, mapSaved: !i.mapSaved } : i));
      setApiError(err.message);
    });
  };

  /* ---- Sources ---- */
  // `file` is a real File object for PDF uploads (from AddSourceModal's
  // <input type="file">); every other source type has no file and goes
  // through the plain JSON path unchanged.
  const addSource = async (partial, investigationKey, file) => {
    try {
      let data;
      if (file) {
        const form = new FormData();
        Object.entries({ ...partial, investigationKey }).forEach(([k, v]) => {
          if (v !== undefined && v !== null) form.append(k, v);
        });
        form.append('file', file);
        data = await api.postForm('/sources', form);
      } else {
        data = await api.post('/sources', { ...partial, investigationKey });
      }
      setSources((prev) => [data.source, ...prev]);
      if (investigationKey) {
        const invData = await api.get(`/investigations/${investigationKey}`);
        setInvestigations((prev) => prev.map((i) => i.key === investigationKey ? invData.investigation : i));
      }
      refreshNotifications();
    } catch (err) {
      setApiError(err.message);
    }
  };
  const deleteSource = async (key) => {
    const prevList = sources;
    setSources((prev) => prev.filter((s) => s.key !== key));
    try {
      await api.del(`/sources/${key}`);
    } catch (err) {
      setSources(prevList);
      setApiError(err.message);
    }
  };
  const unlinkSource = async (key, invKey) => {
    const prevList = sources;
    setSources((prev) => prev.map((s) => s.key === key ? { ...s, usedIn: s.usedIn.filter((k) => k !== invKey) } : s));
    try {
      await api.patch(`/sources/${key}/unlink`, { investigationKey: invKey });
    } catch (err) {
      setSources(prevList);
      setApiError(err.message);
    }
  };
  const toggleSourceSaved = (key) => {
    setSources((prev) => prev.map((s) => s.key === key ? { ...s, saved: !s.saved } : s));
    api.patch(`/sources/${key}/saved`).catch((err) => {
      setSources((prev) => prev.map((s) => s.key === key ? { ...s, saved: !s.saved } : s));
      setApiError(err.message);
    });
  };

  /* ---- Maps (derived from investigations) ---- */
  const maps = useMemo(() => investigations.filter((i) => !i.trashed).map((i) => ({
    key: `map_${i.key}`,
    invKey: i.key,
    title: `${i.title} \u2014 Map`,
    from: i.title,
    visibility: i.visibility,
    tint: i.tint,
    concepts: i.concepts,
    edges: i.edges,
    saved: i.mapSaved,
  })), [investigations]);

  /* ---- Auth ---- */
  const onLogin = (data) => {
    setToken(data.token);
    setUser(data.user);
    navigate('home');
  };
  const onLogout = () => {
    setToken(null);
    setUser(null);
    navigate('home');
  };
  const updateUser = async (patch) => {
    const prevUser = user;
    setUser((prev) => ({ ...prev, ...patch }));
    try {
      const data = await api.patch('/me', patch);
      setUser(data.user);
    } catch (err) {
      setUser(prevUser);
      setApiError(err.message);
    }
  };

  const markNotifRead = (id) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    api.patch(`/notifications/${id}/read`).catch(() => { /* non-critical */ });
  };
  const markAllNotifRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    api.patch('/notifications/read-all').catch(() => { /* non-critical */ });
  };
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#050507] text-[#8891A8] text-sm">
        Loading LENS…
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={onLogin} />;
  }

  const ctx = {
    user, updateUser,
    investigations, sources, maps, notifications,
    navigate, createInvestigation, trashInvestigation, restoreInvestigation,
    toggleConceptSaved, toggleClaimSaved, toggleQuestionSaved, toggleMapSaved, toggleSourceSaved,
    addSource, deleteSource, unlinkSource,
    markNotifRead, markAllNotifRead,
  };

  const renderView = () => {
    switch (view) {
      case 'investigations': return <InvestigationsView />;
      case 'sources': return <SourcesView />;
      case 'maps': return <MapsView />;
      case 'saved': return <SavedView />;
      case 'investigation': return <InvestigationDetailView invKey={activeInvKey} initialTab={activeInvTab} />;
      case 'trash': {
        const trashed = investigations.filter((i) => i.trashed);
        return (
          <div className="px-6 md:px-10 py-8">
            <PageHeader title="Trash" subtitle="Investigations you've removed." />
            {trashed.length === 0 ? (
              <EmptyState icon={Trash2} title="Trash is empty" subtitle="Deleted investigations will show up here." />
            ) : (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0A0A10]/70 overflow-hidden">
                {trashed.map((i) => (
                  <div key={i.key} className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-white/[0.04] last:border-b-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: i.bg }}>
                        <Icon name={i.icon} size={15} color={i.tint} />
                      </div>
                      <span className="text-sm truncate">{i.title}</span>
                    </div>
                    <GhostButton icon={Undo2} onClick={() => restoreInvestigation(i.key)}>Restore</GhostButton>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      case 'shared': {
        const shared = investigations.filter((i) => !i.trashed && i.visibility === 'Shared');
        return (
          <div className="px-6 md:px-10 py-8">
            <PageHeader title="Shared with me" subtitle="Investigations others have shared with you." />
            {shared.length === 0 ? (
              <EmptyState icon={Users} title="Nothing shared yet" subtitle="Items shared with you will show up here." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {shared.map((card) => (
                  <button key={card.key} onClick={() => navigate('investigation', card.key)} className="text-left group rounded-2xl border border-white/[0.07] bg-[#0A0A10]/70 p-5 hover:border-white/[0.14] hover:-translate-y-1 transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: card.bg }}>
                      <Icon name={card.icon} size={18} color={card.tint} />
                    </div>
                    <MiniGraph nodes={card.concepts.map((c) => [c.x, c.y])} edges={card.edges} tint={card.tint} />
                    <h3 className="font-medium text-[15px] mt-2">{card.title}</h3>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      }
      default: return <HomeView />;
    }
  };

  return (
    <AppCtx.Provider value={ctx}>
      <div className="flex h-screen w-full bg-[#050507] text-[#EDEFF6] overflow-hidden">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500&display=swap');
          * { font-family: 'IBM Plex Sans', sans-serif; }
          .font-display { font-family: 'Space Grotesk', sans-serif; }

          .chip { position: absolute; transform: translate(-50%,-50%); transition: transform .7s cubic-bezier(.2,.8,.2,1); }
          .chip.active { transform: translate(calc(-50% + var(--px)), calc(-50% + var(--py))) scale(1.07); }
          .chip-float { animation: chipBob 5s ease-in-out infinite; }
          @keyframes chipBob { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-9px); } }

          .particle { position:absolute; width:3px; height:3px; border-radius:50%; background:rgba(180,190,255,0.7); animation: twinkle 3.2s ease-in-out infinite; }
          @keyframes twinkle { 0%,100% { opacity:0.15; } 50% { opacity:0.8; } }

          .orbit-ring { animation: spin 90s linear infinite; transform-origin: 50% 50%; }
          @keyframes spin { to { transform: rotate(360deg); } }

          .flow-line { stroke-dasharray: 3 5; animation: dashFlow 3s linear infinite; }
          @keyframes dashFlow { to { stroke-dashoffset: -32; } }

          .mini-node { animation: nodePulse 2.6s ease-in-out infinite; }
          @keyframes nodePulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }

          .glow-input { transition: box-shadow .4s ease, border-color .4s ease; }
          .glow-input.on { box-shadow: 0 0 0 1px rgba(167,139,250,0.4), 0 0 70px rgba(129,140,248,0.35); }
        `}</style>

        {/* ---------------- Sidebar ---------------- */}
        <aside className="hidden md:flex w-64 flex-none flex-col border-r border-white/[0.06] bg-[#08080C]/90 px-5 py-6">
          <div className="flex items-center gap-2.5 px-1 mb-8 cursor-pointer" onClick={() => navigate('home')}>
            <div className="w-7 h-7 rounded-full border-2 border-cyan-400 shadow-[0_0_14px_rgba(56,189,248,0.6)]" style={{ borderRightColor: '#A78BFA', borderTopColor: '#A78BFA' }} />
            <span className="font-display font-bold tracking-[0.2em] text-lg">LENS</span>
          </div>

          <button onClick={() => setNewInvOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 mb-7 text-sm font-medium bg-gradient-to-r from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 transition-colors shadow-[0_0_24px_rgba(124,58,237,0.35)]">
            <Plus size={16} /> New Investigation
          </button>

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <button key={item.key} onClick={() => navigate(item.key)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  view === item.key ? 'bg-gradient-to-r from-violet-500/20 to-blue-500/10 text-white border border-white/10' : 'text-[#8891A8] hover:text-white hover:bg-white/[0.04]'
                }`}>
                <item.icon size={17} /> {item.label}
              </button>
            ))}
          </nav>

          <div className="h-px bg-white/[0.06] my-3" />

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS_SECONDARY.map((item) => (
              <button key={item.key} onClick={() => navigate(item.key)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  view === item.key ? 'bg-gradient-to-r from-violet-500/20 to-blue-500/10 text-white border border-white/10' : 'text-[#8891A8] hover:text-white hover:bg-white/[0.04]'
                }`}>
                <item.icon size={17} /> {item.label}
              </button>
            ))}
          </nav>

          <div className="flex-1" />

          <div className="relative">
            <div className="flex items-center gap-2.5 px-1 mb-4 cursor-pointer" onClick={() => setProfileOpen((o) => !o)}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-blue-400 flex items-center justify-center text-xs font-semibold flex-none">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm truncate">{user.name}</div>
                <div className="text-xs text-[#666F87]">Free Plan</div>
              </div>
              <ChevronDown size={14} className="text-[#8891A8] ml-auto flex-none" />
            </div>
            <ProfileMenu open={profileOpen} onClose={() => setProfileOpen(false)} onOpenSettings={() => setSettingsOpen(true)} onLogout={onLogout} direction="up" />
          </div>
          <div className="px-1">
            <div className="flex items-center justify-between text-[11px] text-[#666F87] mb-1.5">
              <span>{Math.min(investigations.filter((i) => !i.trashed).length, 5)} / 5 investigations</span>
              <span>{Math.round((Math.min(investigations.filter((i) => !i.trashed).length, 5) / 5) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, (investigations.filter((i) => !i.trashed).length / 5) * 100)}%` }} />
            </div>
          </div>
        </aside>

        {/* ---------------- Main ---------------- */}
        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-20 flex items-center justify-between gap-6 px-6 md:px-10 py-4 border-b border-white/[0.06] bg-[#050507]/80 backdrop-blur-xl">
            <button onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2.5 flex-1 max-w-md rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-[#8891A8] hover:border-white/20 transition-colors">
              <Search size={15} />
              <span className="flex-1 text-left">Search anything…</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-[#666F87]">{'\u2318'}K</kbd>
            </button>
            <div className="flex items-center gap-4">
              <button title="Light mode coming soon" className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-[#8891A8] hover:text-white transition-colors"><Sun size={15} /></button>
              <div className="relative">
                <button onClick={() => setNotifOpen((o) => !o)} className="relative w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-[#8891A8] hover:text-white transition-colors">
                  <Bell size={15} />
                  {unreadCount > 0 && <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-400" />}
                </button>
                <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setProfileOpen((o) => !o)}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-blue-400 flex items-center justify-center text-xs font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm hidden sm:block">{user.name}</span>
                  <ChevronDown size={14} className="text-[#8891A8]" />
                </div>
                <ProfileMenu open={profileOpen} onClose={() => setProfileOpen(false)} onOpenSettings={() => setSettingsOpen(true)} onLogout={onLogout} />
              </div>
            </div>
          </div>

          {apiError && (
            <div className="mx-6 md:mx-10 mt-4 flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
              <span>{apiError}</span>
              <button onClick={() => setApiError('')} className="text-rose-300 hover:text-rose-100 flex-none"><X size={14} /></button>
            </div>
          )}
          {dataLoading && investigations.length === 0 && (
            <div className="px-6 md:px-10 pt-4 text-xs text-[#666F87]">Loading your investigations…</div>
          )}

          {renderView()}
        </main>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <NewInvestigationModal open={newInvOpen} onClose={() => setNewInvOpen(false)} />
      </div>
    </AppCtx.Provider>
  );
}