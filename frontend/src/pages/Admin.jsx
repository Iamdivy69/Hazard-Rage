import React, { useEffect, useState } from 'react';
import { apiClient, API_BASE, getToken } from '../services/apiClient.js';
import { cityQuery, getCities, setCityId } from '../services/cityStore.js';
import { useToast } from '../providers/ToastProvider.jsx';
import { Layout, HazardBadge, StatusBadge, Skeleton, EmptyState, Field, ReportPhotos } from '../ui/components.jsx';

function useTrends(days = 30) {
  const [data, setData] = useState(null);
  useEffect(() => {
    apiClient.get(`/hazard/trends?days=${days}&${cityQuery()}`).then((r) => setData(r.data)).catch(() => setData({ zones: [] }));
  }, [days]);
  return data;
}

export function AdminDashboard() {
  const trends = useTrends(30);
  const [alerts, setAlerts] = useState(null);
  useEffect(() => {
    apiClient.get('/alerts?status=Active').then((r) => setAlerts(r.data)).catch(() => setAlerts([]));
  }, []);
  const zones = trends?.zones || [];
  const high = zones.filter((z) => z.current_level === 'High').length;

  const downloadCsv = async () => {
    const res = await fetch(`${API_BASE}/exports/reports.csv`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'reports.csv';
    a.click();
  };

  return (
    <Layout wide>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.75rem' }}>
        <h1 className="display">Command center</h1>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <a className="btn" href="/admin/zones/new">Add zone</a>
          <button className="btn" onClick={downloadCsv}>Export CSV</button>
        </div>
      </div>
      {!trends || alerts === null ? <Skeleton /> : (
        <>
          {(alerts.length > 0) && (
            <div className="card" role="alert" style={{ borderColor: 'var(--red)', marginBottom: '1rem' }}>
              🚨 <strong>{alerts.length} active hazard alert{alerts.length > 1 ? 's' : ''}</strong> — {alerts.slice(0, 3).map((a) => `${a.zone?.name || `zone #${a.zoneId}`} (${a.score})`).join(', ')}
              {' '}<a href="/admin/alerts">Review →</a>
            </div>
          )}
          <div className="grid grid-3 stagger">
            <div className="card"><span className="stat">{zones.length}</span><div>zones tracked</div></div>
            <div className="card"><span className="stat">{high}</span><div>high hazard</div></div>
            <div className="card"><span className="stat">{alerts.length}</span><div>active alerts</div></div>
          </div>
          <h2>Zones by hazard</h2>
          <div className="card" style={{ padding: 0 }}>
            {zones.slice().sort((a, b) => b.current_score - a.current_score).map((z) => (
              <a key={z.zone_id} href={`/admin/zones/${z.zone_id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.6rem 1rem', borderBottom: '1px solid #f3f4f6', textDecoration: 'none', color: 'inherit' }}>
                <span><strong>{z.name}</strong> <span style={{ color: 'var(--moss)' }}>{z.current_score?.toFixed?.(1)}</span></span>
                <HazardBadge level={z.current_level} />
              </a>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}

export function ZoneDetail() {
  const id = window.location.pathname.split('/').pop();
  const { toast } = useToast();
  const [detail, setDetail] = useState(null);
  const [cause, setCause] = useState(null);
  const [remed, setRemed] = useState(null);
  const [thresholdVal, setThresholdVal] = useState('7.0');
  const [thresholdBusy, setThresholdBusy] = useState(false);

  useEffect(() => {
    apiClient.get(`/zones/${id}`).then((r) => {
      setDetail(r.data);
      apiClient.get(`/hazard/cause?zone_id=${id}`).then((c) => setCause(c.data)).catch(() => {});
      apiClient.get(`/remediation/suggest?waste_type=${r.data.recent_reports[0]?.wasteType || 'mixed'}&level=${r.data.zone.current_level}`).then((m) => setRemed(m.data)).catch(() => {});
    }).catch(() => setDetail(false));
  }, [id]);

  const updateThreshold = async (e) => {
    e.preventDefault();
    const val = parseFloat(thresholdVal);
    if (isNaN(val) || val < 0 || val > 10) return toast('Threshold must be 0–10');
    setThresholdBusy(true);
    try {
      await apiClient.patch(`/zones/${id}/threshold`, { threshold: val });
      toast(`Alert threshold updated to ${val}`);
    } catch (err) {
      toast(err.message);
    } finally {
      setThresholdBusy(false);
    }
  };

  if (detail === null) return <Layout><Skeleton /></Layout>;
  if (detail === false) return <Layout><EmptyState title="Zone not found" hint="It may have been removed." /></Layout>;
  const max = Math.max(10, ...detail.trend.map((p) => p.score));
  return (
    <Layout wide>
      <div style={{ marginBottom: '1rem' }}><a href="/admin" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 600 }}>← Back to Dashboard</a></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="display" style={{ marginBottom: '.25rem' }}>{detail.zone.name} <HazardBadge level={detail.zone.current_level} /></h1>
          <p style={{ color: 'var(--moss)' }}>Current Hazard Score: <strong>{Number(detail.zone.current_score).toFixed(1)}</strong> / 10 · Land use: <strong>{detail.zone.zone_type}</strong></p>
        </div>
        <form onSubmit={updateThreshold} className="card" style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.6rem 1rem' }}>
          <label style={{ fontSize: '.9rem', fontWeight: 600 }}>Alert threshold:</label>
          <input className="card" type="number" step="0.1" min="0" max="10" style={{ width: 70, padding: '.3rem .5rem' }} value={thresholdVal} onChange={(e) => setThresholdVal(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={thresholdBusy}>{thresholdBusy ? 'Saving…' : 'Set'}</button>
        </form>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', marginTop: '1rem' }}>
        <div className="card"><strong>30-day trend</strong>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90, marginTop: '.5rem' }}>
            {detail.trend.length === 0 ? <span style={{ color: 'var(--moss)' }}>No history yet</span> :
              detail.trend.map((p, i) => <div key={i} title={`${p.score} @ ${new Date(p.at || p.computedAt).toLocaleDateString()}`} style={{ flex: 1, background: p.score >= 7 ? 'var(--red)' : p.score >= 4 ? 'var(--amber)' : 'var(--green)', height: `${(p.score / max) * 100}%`, borderRadius: 2 }} />)}
          </div></div>
        <div className="card"><strong>Likely cause</strong><div style={{ color: 'var(--moss)', marginTop: '.4rem' }}>{cause ? `${cause.hypothesis} (confidence: ${cause.confidence})` : 'Analyzing…'}</div></div>
        <div className="card"><strong>Recommended action</strong><div style={{ marginTop: '.4rem' }}>{remed ? remed.actions.map((a, i) => <div key={i}>• {a}</div>) : 'Loading…'}</div></div>
      </div>
      <h2>Recent reports</h2>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {detail.recent_reports.length === 0 ? <div style={{ padding: '1rem' }}>No reports.</div> :
          detail.recent_reports.map((r) => (
            <div key={r.id} style={{ padding: '.6rem 1rem', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '.8rem', alignItems: 'center' }}>
              <ReportPhotos report={r} />
              <span className="mono">#{r.id}</span>
              <span>{r.wasteType}/{r.severity}</span>
              {r.description && <span style={{ color: 'var(--moss)', fontSize: '.9rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</span>}
              <span style={{ marginLeft: 'auto' }}><StatusBadge status={r.status === 'In_Progress' ? 'In Progress' : r.status} /></span>
            </div>
          ))}
      </div>
    </Layout>
  );
}

export function ReportsManage() {
  const { toast } = useToast();
  const [status, setStatus] = useState('');
  const [reports, setReports] = useState(null);
  const load = () => {
    setReports(null);
    apiClient.get(`/reports?limit=50${status ? `&status=${encodeURIComponent(status)}` : ''}`)
      .then((r) => setReports(r.data))
      .catch(() => setReports([]));
  };
  useEffect(() => {
    load();
  }, [status]);

  const setReportStatus = async (id, s) => {
    try {
      const r = await apiClient.patch(`/reports/${id}/status`, { status: s });
      toast(`Report #${id} → ${s} (score ${r.data.newScore.score})`);
      load();
    } catch (err) { toast(err.message); }
  };

  const resolveFile = React.useRef(null);
  const [resolvingId, setResolvingId] = useState(null);
  const askResolve = (id) => { setResolvingId(id); resolveFile.current?.click(); };
  const onResolveFile = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (resolvingId === null) return;
    const fd = new FormData();
    fd.append('status', 'Resolved');
    if (f) fd.append('image', f);
    try {
      const r = await apiClient.patchForm(`/reports/${resolvingId}/status`, fd);
      toast(`Report #${resolvingId} resolved with photo (score ${r.data.newScore.score})`);
      load();
    } catch (err) { toast(err.message); }
    finally { setResolvingId(null); }
  };
  return (
    <Layout wide>
      <h1 className="display">Reports</h1>
      <input ref={resolveFile} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onResolveFile} aria-label="Cleanup photo" />
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['', 'Pending', 'In Progress', 'Resolved'].map((s) => (
          <button key={s} className="btn" style={status === s ? { background: '#111418', color: '#fff' } : {}} onClick={() => setStatus(s)}>{s || 'All'}</button>
        ))}
        <button className="btn" onClick={load}>Refresh</button>
      </div>
      {reports === null ? <Skeleton /> : reports.length === 0 ? <EmptyState title="No reports" hint="Try a different filter." /> : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="ledger">
            <thead><tr><th>ID</th><th>Photo</th><th>Zone</th><th>Type / Sev</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{reports.map((r) => (
              <tr key={r.id}>
                <td className="mono">#{r.id}</td>
                <td>
                  <ReportPhotos report={r} />
                </td>
                <td><a href={`/admin/zones/${r.zoneId}`} style={{ color: 'inherit', fontWeight: 600 }}>Zone #{r.zoneId}</a></td>
                <td>{r.wasteType} / {r.severity}</td>
                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--moss)' }}>{r.description || '—'}</td>
                <td><StatusBadge status={r.status} /></td>
                <td><div style={{ display: 'flex', gap: '.4rem' }}>
                  {r.status === 'Pending' && <button className="btn" onClick={() => setReportStatus(r.id, 'In Progress')}>Start</button>}
                  {r.status === 'In Progress' && <button className="btn btn-primary" onClick={() => askResolve(r.id)}>Resolve + photo</button>}
                </div></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}

export function AlertsList() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState(null);
  const load = () => apiClient.get('/alerts').then((r) => setAlerts(r.data)).catch(() => setAlerts([]));
  useEffect(load, []);
  const ack = async (id) => {
    try { await apiClient.patch(`/alerts/${id}/ack`, {}); toast(`Alert #${id} acknowledged`); load(); }
    catch (err) { toast(err.message); }
  };
  return (
    <Layout wide>
      <h1 className="display">Alerts</h1>
      {alerts === null ? <Skeleton /> : alerts.length === 0 ? <EmptyState title="No alerts" hint="Zones breaching score 7.0 will appear here." /> : (
        <div className="grid">{alerts.map((a) => (
          <div key={a.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.75rem' }}>
            <div>
              🚨 <strong>{a.zone?.name || `Zone #${a.zoneId}`}</strong> (Zone #{a.zoneId}) — score <strong>{a.score}</strong> (threshold {a.threshold}) <StatusBadge status={a.status === 'Active' ? 'Pending' : a.status} />
            </div>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <a className="btn" href={`/admin/zones/${a.zoneId}`} style={{ textDecoration: 'none' }}>View zone</a>
              {a.status === 'Active' && <button className="btn btn-primary" onClick={() => ack(a.id)}>Acknowledge</button>}
            </div>
          </div>))}
        </div>
      )}
    </Layout>
  );
}

export function CitiesManage() {
  const { toast } = useToast();
  const [cities, setCities] = useState(null);
  const [form, setForm] = useState({ name: '', state: '', lat: '', lng: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => apiClient.get('/cities').then((r) => setCities(r.data)).catch(() => setCities([]));
  useEffect(load, []);
  const openCity = (id) => { setCityId(id); window.location.href = '/admin/map'; };
  const submit = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await apiClient.post('/cities', {
        name: form.name, state: form.state || undefined,
        lat: Number(form.lat), lng: Number(form.lng),
      });
      toast(`City "${r.data.name}" added — add its first zone next`);
      setForm({ name: '', state: '', lat: '', lng: '' });
      load();
    } catch (err) { setError(err.details?.map((d) => d.message).join(', ') || err.message); }
    finally { setBusy(false); }
  };
  return (
    <Layout wide>
      <h1 className="display">Cities</h1>
      <p style={{ color: 'var(--moss)' }}>Every city gets its own zones, scores, trends and alerts. Add one, then plant its wards.</p>
      {cities === null ? <Skeleton /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
          <table className="ledger">
            <thead><tr><th>City</th><th>State</th><th>Zones</th><th>Center</th><th></th></tr></thead>
            <tbody>{cities.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.state || '—'}</td>
                <td className="mono">{c.zones ?? '—'}</td>
                <td className="mono" style={{ color: 'var(--moss)' }}>{Number(c.lat).toFixed(2)}, {Number(c.lng).toFixed(2)}</td>
                <td><button className="btn" onClick={() => openCity(c.id)}>Open</button></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
      <h2>Add a city</h2>
      {error && <div className="card" role="alert" style={{ borderColor: 'var(--high)', marginBottom: '1rem' }}>{error}</div>}
      <form onSubmit={submit} className="grid" style={{ maxWidth: 520 }}>
        <Field label="City name"><input className="card" required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ahmedabad" /></Field>
        <Field label="State"><input className="card" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="e.g. Gujarat" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
          <Field label="Center latitude"><input className="card" required type="number" step="0.0001" min="-90" max="90" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></Field>
          <Field label="Center longitude"><input className="card" required type="number" step="0.0001" min="-180" max="180" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></Field>
        </div>
        <button className="btn btn-paint" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add city'}</button>
      </form>
    </Layout>
  );
}
