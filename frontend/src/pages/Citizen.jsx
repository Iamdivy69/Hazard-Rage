import React, { useEffect, useState } from 'react';
import { apiClient, API_BASE } from '../services/apiClient.js';
import { cityQuery } from '../services/cityStore.js';
import { useToast } from '../providers/ToastProvider.jsx';
import { Layout, HazardBadge, StatusBadge, Skeleton, EmptyState, Field, ReportPhotos, go } from '../ui/components.jsx';

export function useZones() {
  const [data, setData] = useState(null);
  useEffect(() => {
    apiClient.get(`/zones?${cityQuery()}`).then((r) => setData(r.data)).catch(() => setData([]));
  }, []);
  return { zones: data || [], loading: data === null };
}

export function CitizenHome() {
  const { zones, loading } = useZones();
  return (
    <Layout wide>
      <h1 className="display">Waste near you</h1>
      <p style={{ color: 'var(--moss)' }}>Live hazard scores across all city zones. <a href="/report/new">Report waste</a> to update your zone.</p>
      {loading ? <Skeleton /> : zones.length === 0 ? <EmptyState title="No zones yet" hint="The database hasn't been seeded." /> : (
        <div className="grid grid-3 stagger">
          {zones.slice().sort((a, b) => b.current_score - a.current_score).map((z) => (
            <div key={z.id} className="card">
              <strong>{z.name}</strong>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginTop: '.4rem' }}>
                <HazardBadge level={z.current_level} />
                <span style={{ color: 'var(--moss)' }}>{Number(z.current_score).toFixed(1)} / 10</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function ReportNew() {
  const { toast } = useToast();
  const { zones, loading } = useZones();
  const [form, setForm] = useState({ zone_id: '', waste_type: 'plastic', severity: 'Med', description: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0] || null;
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  // Live location → nearest ward auto-select (haversine over loaded wards).
  const [coords, setCoords] = useState(null);
  const [locStatus, setLocStatus] = useState('idle');
  const nearest = React.useMemo(() => {
    if (!coords || !zones.length) return null;
    let best = null, bestKm = Infinity;
    for (const z of zones) {
      const km = haversineKm(coords.lat, coords.lng, z.lat, z.lng);
      if (km < bestKm) { bestKm = km; best = z; }
    }
    return best ? { zone: best, km: bestKm } : null;
  }, [coords, zones]);

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) { setLocStatus('unsupported'); return; }
    setLocStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: Number(pos.coords.latitude.toFixed(5)), lng: Number(pos.coords.longitude.toFixed(5)), acc: Math.round(pos.coords.accuracy || 0) };
        setCoords(c);
        setLocStatus('fixed');
        if (zones.length) {
          let best = null, bestKm = Infinity;
          for (const z of zones) {
            const km = haversineKm(c.lat, c.lng, z.lat, z.lng);
            if (km < bestKm) { bestKm = km; best = z; }
          }
          if (best && bestKm <= 25) setForm((f) => ({ ...f, zone_id: String(best.id) }));
        }
      },
      (err) => setLocStatus(err.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  // Camera capture (secure contexts: localhost/https). Falls back to file input.
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState(null);
  const startCamera = async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setCamOn(true);
      requestAnimationFrame(() => { if (videoRef.current) videoRef.current.srcObject = stream; });
    } catch {
      setCamError('Camera unavailable — allow access or use file upload instead.');
    }
  };
  const stopCamera = () => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    streamRef.current = null;
    setCamOn(false);
  };
  React.useEffect(() => () => { try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {} }, []);
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const f = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setFile(f);
      setPreview(URL.createObjectURL(f));
      stopCamera();
    }, 'image/jpeg', 0.85);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const fd = new FormData();
      if (form.zone_id) fd.append('zone_id', form.zone_id);
      fd.append('waste_type', form.waste_type);
      fd.append('severity', form.severity);
      if (form.description) fd.append('description', form.description);
      if (coords) { fd.append('lat', String(coords.lat)); fd.append('lng', String(coords.lng)); }
      if (file) fd.append('image', file);
      const r = await apiClient.postForm('/reports', fd);
      setDone(r.data);
      toast(`Report #${r.data.report.id} submitted — zone score ${r.data.hazardScore.score}`);
    } catch (err) { setError(err.details?.map((d) => d.message).join(', ') || err.message); }
    finally { setBusy(false); }
  };

  if (done) {
    const matchedZone = zones.find((z) => z.id === done.report.zoneId);
    return <Layout><h1 className="display">Report submitted ✅</h1>
      <div className="card"><div>Report <strong>#{done.report.id}</strong> in zone <strong>{matchedZone?.name || `Zone #${done.report.zoneId}`}</strong></div>
      <div style={{ marginTop: '.5rem' }}>New hazard score: <strong>{done.hazardScore.score}</strong> <HazardBadge level={done.hazardScore.level} /></div>
      {done.alert && <div style={{ marginTop: '.5rem' }}>🚨 Hazard alert triggered for this zone.</div>}</div>
      <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}><button className="btn btn-primary" onClick={() => go('/my-reports')}>Track my reports</button><button className="btn" onClick={() => { setDone(null); setFile(null); setPreview(null); }}>Report another</button></div>
    </Layout>;
  }

  return (
    <Layout>
      <h1 className="display">Report waste</h1>
      <p style={{ color: 'var(--moss)' }}>Takes under a minute. Photo evidence helps officers prioritize.</p>
      {error && <div className="card" role="alert" style={{ borderColor: 'var(--red)', marginBottom: '1rem' }}>{error}</div>}
      <form onSubmit={submit} className="grid" style={{ maxWidth: 520 }}>
        <div className="card">
          <strong>Locate the waste</strong>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem', flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={useMyLocation} disabled={locStatus === 'locating'}>
              {locStatus === 'locating' ? 'Locating…' : 'Use my location'}
            </button>
            {coords && <button className="btn" type="button" onClick={() => { setCoords(null); setLocStatus('idle'); }}>Clear</button>}
          </div>
          <div style={{ color: 'var(--moss)', fontSize: '.9rem', marginTop: '.4rem' }} role="status">
            {locStatus === 'idle' && 'Or pick the ward manually below.'}
            {locStatus === 'locating' && 'Reading GPS…'}
            {locStatus === 'denied' && 'Location blocked — allow access in the browser, or pick the ward manually.'}
            {locStatus === 'unavailable' && 'Location unavailable on this device — pick the ward manually.'}
            {locStatus === 'unsupported' && 'Geolocation is not supported here — pick the ward manually.'}
            {locStatus === 'fixed' && coords && (
              <>Pinned at <span className="mono">{coords.lat}, {coords.lng}</span> (±{coords.acc}m){nearest ? <> — nearest ward <strong>{nearest.zone.name}</strong> ({nearest.km.toFixed(1)} km){nearest.km > 25 ? ' (too far — pick manually)' : ' (auto-selected)'}</> : ''}</>
            )}
          </div>
        </div>
        <Field label="Zone">{loading ? <Skeleton n={1} /> : (
          <select className="card" required value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })}>
            <option value="">— pick a zone —</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name} ({z.current_level})</option>)}
          </select>)}</Field>
        <Field label="Waste type">
          <select className="card" value={form.waste_type} onChange={(e) => setForm({ ...form, waste_type: e.target.value })}>
            <option value="organic">Organic</option><option value="plastic">Plastic / recyclables</option>
            <option value="construction">Construction debris</option><option value="biomedical">Biomedical</option><option value="mixed">Mixed / hazardous</option>
          </select></Field>
        <Field label="Severity">
          <select className="card" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            <option value="Low">Low</option><option value="Med">Medium</option><option value="High">High</option>
          </select></Field>
        <Field label="Photo (jpg/png/webp, max 5MB)">
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <input className="card" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
            {!camOn
              ? <button className="btn" type="button" onClick={startCamera}>Take photo</button>
              : <button className="btn btn-primary" type="button" onClick={capturePhoto}>Capture</button>}
            {camOn && <button className="btn" type="button" onClick={stopCamera}>Close camera</button>}
          </div>
          {camError && <div role="alert" style={{ color: 'var(--high)', fontSize: '.9rem', marginTop: '.4rem' }}>{camError}</div>}
          {camOn && <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxWidth: 420, borderRadius: 6, marginTop: '.5rem', background: '#000' }} />}
          {preview && (
            <div style={{ marginTop: '.5rem' }}>
              <img src={preview} alt="Selected preview" style={{ maxWidth: 200, maxHeight: 150, borderRadius: 6, objectFit: 'cover' }} />
            </div>
          )}
        </Field>
        <Field label="Description"><textarea className="card" rows={3} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Overflowing dump near market gate…" /></Field>
        <button className="btn btn-paint" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</button>
      </form>
    </Layout>
  );
}

export function MyReports() {
  const [reports, setReports] = useState(null);
  useEffect(() => {
    apiClient.get('/reports?mine=true&limit=50').then((r) => setReports(r.data)).catch(() => setReports([]));
  }, []);
  return (
    <Layout wide>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="display">My reports</h1>
        <a className="btn btn-primary" href="/report/new">New report</a>
      </div>
      {reports === null ? <Skeleton /> : reports.length === 0 ? (
        <EmptyState title="No reports yet" hint="Your submissions will appear here with live status." action={<a className="btn btn-primary" href="/report/new">Report waste</a>} />
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto', marginTop: '1rem' }}>
          <table className="ledger">
            <thead><tr><th>ID</th><th>Photo</th><th>Zone</th><th>Type / Sev</th><th>Status</th><th>Reported</th></tr></thead>
            <tbody>{reports.map((r) => (
              <tr key={r.id}>
                <td className="mono">#{r.id}</td>
                <td>
                  <ReportPhotos report={r} />
                </td>
                <td>Zone #{r.zoneId}</td>
                <td>{r.wasteType} / {r.severity}</td>
                <td><StatusBadge status={r.status} /></td>
                <td style={{ color: 'var(--moss)' }}>{new Date(r.reportedAt).toLocaleDateString()}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
