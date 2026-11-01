import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { Layout, Field } from '../ui/components.jsx';
import { useToast } from '../providers/ToastProvider.jsx';

function redirectTo(user) {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  if (redirect && redirect.startsWith('/')) { window.location.href = redirect; return; }
  window.location.href = (user.role === 'municipal_admin' || user.role === 'system_admin') ? '/admin' : '/home';
}

function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="card" role="alert" style={{ borderColor: 'var(--high)', marginBottom: '1rem' }}>{error}</div>;
}

function PasswordInput({ value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ display: 'flex', gap: '.5rem' }}>
      <input className="card" style={{ flex: 1 }} type={show ? 'text' : 'password'} required
        value={value} onChange={onChange} autoComplete={autoComplete} />
      <button className="btn" type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? 'Hide' : 'Show'}
      </button>
    </span>
  );
}

function AuthShell({ kicker, title, lede, children }) {
  const [stats, setStats] = useState(null);
  const [worst, setWorst] = useState(null);
  useEffect(() => {
    apiClient.get('/stats').then((r) => setStats(r.data)).catch(() => {});
    apiClient.get('/zones').then((r) => {
      const ranked = (r.data || []).slice().sort((a, b) => b.current_score - a.current_score);
      setWorst(ranked[0] || null);
    }).catch(() => {});
  }, []);
  return (
    <Layout wide>
      <div className="auth-split rise">
        <section className="panel-hero">
          <p className="kicker" style={{ color: '#b9c4b4' }}>{kicker}</p>
          <h1 className="display" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>{title}</h1>
          <p className="lede">{lede}</p>
          <div style={{ marginTop: '2rem' }}>
            <div className="score-readout" style={{ fontSize: 'clamp(2.6rem, 6vw, 4.5rem)' }}>
              {worst ? Number(worst.current_score).toFixed(1) : '––'}<small> / 10</small>
            </div>
            <div style={{ color: '#b9c4b4' }}>
              {worst ? `worst ward: ${worst.name}` : 'reading the wards…'}
              {stats !== null && ` · ${stats.reports} reports filed · ${stats.activeAlerts} alerts open`}
            </div>
          </div>
        </section>
        <section>{children}</section>
      </div>
    </Layout>
  );
}

export function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fillDemo = (email) => setForm({ email, password: 'password123' });
  const submit = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await apiClient.post('/auth/login', form);
      login(r.data.user, r.data.token);
      toast(`Welcome back, ${r.data.user.name}`);
      redirectTo(r.data.user);
    } catch (err) { setError(err.details?.map((d) => d.message).join(', ') || err.message); }
    finally { setBusy(false); }
  };
  return (
    <AuthShell kicker="Field access" title="Back on the beat."
      lede="Sign in to file reports, track cleanups, or open the command center.">
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 .25rem' }}>Login</h2>
      <p style={{ color: 'var(--moss)', marginTop: 0 }}>New here? <a href="/register">Create an account</a></p>
      <ErrorBox error={error} />
      <form onSubmit={submit} className="grid">
        <Field label="Email"><input className="card" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></Field>
        <Field label="Password"><PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" /></Field>
        <button className="btn btn-paint" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Login'}</button>
      </form>
      <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--rule)', paddingTop: '.9rem' }}>
        <div style={{ color: 'var(--moss)', fontSize: '.9rem', marginBottom: '.5rem' }}>Evaluating? One click fills a demo account.</div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={() => fillDemo('citizen@hazard.local')}>Citizen demo</button>
          <button className="btn" type="button" onClick={() => fillDemo('admin@hazard.local')}>Admin demo</button>
        </div>
      </div>
    </AuthShell>
  );
}

export function Register() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await apiClient.post('/auth/register', form);
      login(r.data.user, r.data.token);
      toast(`Welcome, ${r.data.user.name}!`);
      redirectTo(r.data.user);
    } catch (err) { setError(err.details?.map((d) => d.message).join(', ') || err.message); }
    finally { setBusy(false); }
  };
  return (
    <AuthShell kicker="Join the survey" title="Your ward needs eyes."
      lede="One account, sixty-second reports, status tracked to resolution.">
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 .25rem' }}>Create your account</h2>
      <p style={{ color: 'var(--moss)', marginTop: 0 }}>Already registered? <a href="/login">Login</a></p>
      <ErrorBox error={error} />
      <form onSubmit={submit} className="grid">
        <Field label="Full name"><input className="card" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></Field>
        <Field label="Email"><input className="card" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></Field>
        <Field label="Password (min 6 characters)"><PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></Field>
        <button className="btn btn-paint" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Register'}</button>
      </form>
    </AuthShell>
  );
}
