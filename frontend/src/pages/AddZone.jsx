import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient.js';
import { getCities, getCityId } from '../services/cityStore.js';
import { useToast } from '../providers/ToastProvider.jsx';
import { Layout, Field, Skeleton, go } from '../ui/components.jsx';

// Click-to-place: inverse of the survey-plot projection fills lat/lng.
function PickPlot({ zones, onPick, cursor }) {
  const W = 1000, H = 420, PAD = 40;
  if (!zones.length) return null;
  const lats = zones.map((z) => z.lat), lngs = zones.map((z) => z.lng);
  const minLat = Math.min(...lats) - 0.01, maxLat = Math.max(...lats) + 0.01;
  const minLng = Math.min(...lngs) - 0.01, maxLng = Math.max(...lngs) + 0.01;
  const toXY = (lat, lng) => [
    PAD + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * PAD),
    PAD + ((maxLat - lat) / (maxLat - minLat)) * (H - 2 * PAD),
  ];
  const fromXY = (x, y) => [
    maxLat - ((y - PAD) / (H - 2 * PAD)) * (maxLat - minLat),
    minLng + ((x - PAD) / (W - 2 * PAD)) * (maxLng - minLng),
  ];
  const click = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const [lat, lng] = fromXY(x, y);
    onPick(Number(lat.toFixed(4)), Number(lng.toFixed(4)));
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} onClick={click} style={{ width: '100%', height: 'auto', display: 'block', background: 'var(--paper)', borderRadius: 6, cursor: 'crosshair' }} role="img" aria-label="Click to place new zone">
      {zones.map((z) => {
        const [cx, cy] = toXY(z.lat, z.lng);
        return <circle key={z.id} cx={cx} cy={cy} r="10" fill="var(--moss)" opacity="0.5"><title>{z.name}</title></circle>;
      })}
      {cursor && (() => { const [cx, cy] = toXY(cursor.lat, cursor.lng); return (<g><circle cx={cx} cy={cy} r="14" fill="none" stroke="var(--safety)" strokeWidth="3" /><circle cx={cx} cy={cy} r="4" fill="var(--safety)" /></g>); })()}
    </svg>
  );
}

export function AddZone() {
  const { toast } = useToast();
  const [cities, setCities] = useState(null);
  const [zones, setZones] = useState([]);
  const [form, setForm] = useState({ city_id: String(getCityId()), name: '', zone_type: 'residential', lat: '', lng: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getCities().then(setCities); }, []);
  useEffect(() => {
    if (!form.city_id) return;
    apiClient.get(`/zones?city_id=${form.city_id}`).then((r) => setZones(r.data)).catch(() => setZones([]));
  }, [form.city_id]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await apiClient.post('/zones', {
        city_id: Number(form.city_id), name: form.name, zone_type: form.zone_type,
        lat: Number(form.lat), lng: Number(form.lng),
      });
      toast(`Zone "${r.data.name}" added`);
      go(`/admin/zones/${r.data.id}`);
    } catch (err) { setError(err.details?.map((d) => d.message).join(', ') || err.message); }
    finally { setBusy(false); }
  };

  return (
    <Layout>
      <h1 className="display">Add a zone</h1>
      <p style={{ color: 'var(--moss)' }}>Click the survey plot to drop the pin, or type coordinates directly.</p>
      {error && <div className="card" role="alert" style={{ borderColor: 'var(--high)', marginBottom: '1rem' }}>{error}</div>}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <PickPlot zones={zones} cursor={form.lat !== '' && form.lng !== '' ? { lat: Number(form.lat), lng: Number(form.lng) } : null}
          onPick={(lat, lng) => setForm((f) => ({ ...f, lat: String(lat), lng: String(lng) }))} />
      </div>
      {cities === null ? <Skeleton n={2} /> : (
        <form onSubmit={submit} className="grid" style={{ maxWidth: 520 }}>
          <Field label="City">
            <select className="card" value={form.city_id} onChange={(e) => setForm({ ...form, city_id: e.target.value })}>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></Field>
          <div style={{ fontSize: '.9rem' }}><a href="/admin/cities">New city? Add it first</a></div>
          <Field label="Zone name"><input className="card" required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Race Course" /></Field>
          <Field label="Land use">
            <select className="card" value={form.zone_type} onChange={(e) => setForm({ ...form, zone_type: e.target.value })}>
              <option value="residential">Residential</option><option value="commercial">Commercial</option>
              <option value="market">Market</option><option value="industrial">Industrial</option>
              <option value="drainage">Drainage</option><option value="construction">Construction</option>
            </select></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
            <Field label="Latitude"><input className="card" required type="number" step="0.0001" min="-90" max="90" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></Field>
            <Field label="Longitude"><input className="card" required type="number" step="0.0001" min="-180" max="180" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></Field>
          </div>
          <button className="btn btn-paint" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add zone'}</button>
        </form>
      )}
    </Layout>
  );
}
