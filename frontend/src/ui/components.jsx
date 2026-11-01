import { useAuth } from '../providers/AuthProvider.jsx';
import { API_BASE } from '../services/apiClient.js';
import { getCities, getCityId, setCityId } from '../services/cityStore.js';
import React, { useEffect, useState } from 'react';

export function imgUrl(u) {
  if (!u) return null;
  return u.startsWith('http') ? u : `${API_BASE.replace('/api/v1', '')}${u}`;
}

export function Thumb({ src, label }) {
  if (!src) return null;
  const url = imgUrl(src);
  return (
    <a href={url} target="_blank" rel="noreferrer" title={label}>
      <img src={url} alt={label} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
    </a>
  );
}

export function ReportPhotos({ report }) {
  if (!report.imageUrl && !report.resolvedImageUrl) return <span style={{ color: 'var(--moss)' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <Thumb src={report.imageUrl} label={`Before — report #${report.id}`} />
      {report.resolvedImageUrl && <span aria-hidden="true" style={{ color: 'var(--moss)' }}>→</span>}
      <Thumb src={report.resolvedImageUrl} label={`After — report #${report.id}`} />
    </span>
  );
}

export function HazardBadge({ level }) {
  const icon = level === 'High' ? '🔴' : level === 'Medium' ? '🟡' : '🟢';
  return <span className={`badge badge-${level}`} aria-label={`hazard ${level}`}>{icon} {level}</span>;
}

export function StatusBadge({ status }) {
  const map = { Pending: '◷ Pending', 'In Progress': '⚙ In Progress', Resolved: '● Resolved' };
  return <span className="badge" style={{ color: 'var(--pine-soft)', background: 'transparent' }}>{map[status] || status}</span>;
}

export function Skeleton({ n = 3 }) {
  return <div className="grid" aria-busy="true">{Array.from({ length: n }).map((_, i) => <div key={i} className="skeleton" style={{ height: 60 }} />)}</div>;
}

export function EmptyState({ title, hint, action }) {
  return <div className="card" role="status"><strong>{title}</strong><div style={{ color: 'var(--moss)', margin: '.3rem 0 .8rem' }}>{hint}</div>{action}</div>;
}

export function Field({ label, children, error }) {
  return <label style={{ display: 'grid', gap: 4 }}><span style={{ fontWeight: 600 }}>{label}</span>{children}
    {error && <span role="alert" style={{ color: 'var(--red)', fontSize: '.85rem' }}>{error}</span>}</label>;
}

export function go(path) { window.location.href = path; }

export function CityPicker() {
  const [cities, setCities] = useState(null);
  const [current, setCurrent] = useState(getCityId());
  useEffect(() => { getCities().then(setCities); }, []);
  if (!cities) return null;
  return (
    <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontWeight: 600 }}>
      City
      <select className="card" style={{ padding: '.35rem .6rem' }} aria-label="Select city" value={current}
        onChange={(e) => { const id = parseInt(e.target.value, 10); setCityId(id); setCurrent(id); window.location.reload(); }}>
        {cities.map((c) => <option key={c.id} value={c.id}>{c.name}{c.zones ? ` (${c.zones})` : ''}</option>)}
      </select>
    </label>
  );
}

export function Nav() {
  const { user, logout } = useAuth();
  const isAdmin = user && (user.role === 'municipal_admin' || user.role === 'system_admin');
  const here = typeof window !== 'undefined' ? window.location.pathname : '';
  const link = (href, label) => {
    if (here === href || (href !== '/' && here.startsWith(href))) {
      return <span key={href} style={{ fontWeight: 700, borderBottom: '3px solid var(--safety)', paddingBottom: 2 }}>{label}</span>;
    }
    return <a key={href} href={href} style={{ textDecoration: 'none', color: 'inherit', fontWeight: 600 }}>{label}</a>;
  };
  return (
    <header className="toolbar">
      <a className="wordmark" href={user ? (isAdmin ? '/admin' : '/home') : '/'}><span className="wordmark-mark" aria-hidden="true" /><b>Hazard Rage</b></a>
      <CityPicker />
      <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginLeft: 'auto' }}>
        {!user && <>{link('/#how', 'How it works')}{link('/login', 'Login')}<a className="btn btn-paint" href="/register">Get started</a></>}
        {user && !isAdmin && <>{link('/home', 'Zones')}{link('/report/new', 'Report')}{link('/my-reports', 'My reports')}</>}
        {user && isAdmin && <>{link('/admin', 'Dashboard')}{link('/admin/map', 'Heatmap')}{link('/admin/reports', 'Reports')}{link('/admin/alerts', 'Alerts')}{link('/admin/cities', 'Cities')}{link('/report/new', '+ Report')}</>}
        {user && <><span style={{ color: 'var(--pine)', fontWeight: 700 }} title={user.role}>{user.name} <span className="badge" style={{ fontSize: '.72rem', padding: '.1rem .5rem' }}>{isAdmin ? 'officer' : 'citizen'}</span></span><button className="btn" onClick={() => { logout(); go('/'); }}>Logout</button></>}
      </nav>
    </header>
  );
}

export function Layout({ children, wide = false }) {
  return (<><Nav /><main style={{ padding: '1.5rem 1rem 3rem', maxWidth: wide ? 1200 : 900, margin: '0 auto' }}>{children}</main></>);
}
