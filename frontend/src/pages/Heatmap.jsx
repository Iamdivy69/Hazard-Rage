import React, { useEffect, useRef, useState } from 'react';
import { Map, Popup, config as mlConfig } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { apiClient, API_BASE } from '../services/apiClient.js';
import { getCities, getCityId } from '../services/cityStore.js';
import { Layout, HazardBadge, Skeleton, EmptyState } from '../ui/components.jsx';
import 'maplibre-gl/dist/maplibre-gl.css';

const color = (l) => l === 'High' ? '#dc2626' : l === 'Medium' ? '#d97706' : '#16a34a';
const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const REFRESH_MS = 30000;

function toGeoJSON(zones) {
  return {
    type: 'FeatureCollection',
    features: zones.map((z) => ({
      type: 'Feature',
      properties: {
        id: z.id, name: z.name,
        score: Number(z.current_score), level: z.current_level,
        color: color(z.current_level),
        radius: 10 + Math.min(14, Number(z.current_score)),
      },
      geometry: { type: 'Point', coordinates: [z.lng, z.lat] },
    })),
  };
}

function LiveMap({ zones, center, onMapDead }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const [updatedAgo, setUpdatedAgo] = useState(0);

  // Build-time bundled worker: Vite serves it as a real asset URL, so the
  // map never depends on resolving the worker out of node_modules at runtime.
  if (!mlConfig.WORKER_URL) mlConfig.WORKER_URL = workerUrl;

  // Build the map once per city; then only refresh ward data.
  useEffect(() => {
    let map, timer, ticker, dead = false;
    try {
      map = new Map({
        container: divRef.current,
        style: STYLE,
        center: [center[1], center[0]],
        zoom: 11.5,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
    } catch {
      onMapDead();
      return undefined;
    }
    const fail = () => { if (!dead) { dead = true; onMapDead(); } };
    map.on('error', fail);

    map.on('load', () => {
      map.addSource('wards', { type: 'geojson', data: toGeoJSON(zones) });
      map.addLayer({
        id: 'ward-halax', type: 'circle', source: 'wards',
        paint: {
          'circle-radius': ['+', 8, ['*', ['get', 'score'], 2.2]],
          'circle-color': ['get', 'color'], 'circle-opacity': 0.25,
        },
      });
      map.addLayer({
        id: 'wards', type: 'circle', source: 'wards',
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': ['get', 'color'], 'circle-opacity': 0.9,
          'circle-stroke-width': 2, 'circle-stroke-color': '#f4f6f0',
        },
      });
      map.on('click', 'wards', (e) => {
        const f = e.features[0];
        new Popup({ closeButton: false })
          .setLngLat(f.geometry.coordinates)
          .setHTML(`<strong>${f.properties.name}</strong> — ${Number(f.properties.score).toFixed(1)} (${f.properties.level})<br><a href="/admin/zones/${f.properties.id}">Open ward file</a>`)
          .addTo(map);
      });
      map.on('mouseenter', 'wards', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'wards', () => { map.getCanvas().style.cursor = ''; });

  // Parent pushes fresh ward data (SSE instant + 30s poll fallback);
  // repaint the source in place whenever it arrives.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('wards')) return;
    try { map.getSource('wards').setData(toGeoJSON(zones)); setUpdatedAgo(0); } catch {}
  }, [zones]);
      ticker = setInterval(() => setUpdatedAgo((s) => s + 1), 1000);
    });

    return () => { dead = true; clearInterval(timer); clearInterval(ticker); map.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);

  return (
    <>
      <div ref={divRef} style={{ height: 440, borderRadius: 6 }} />
      <div className="mono" style={{ fontSize: '.82rem', color: 'var(--moss)', padding: '.4rem .2rem 0' }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#15803d', marginRight: 6 }} />
        Live — ward data refreshes every 30s{updatedAgo > 2 ? ` · updated ${updatedAgo}s ago` : ''}
      </div>
    </>
  );
}

function SurveyFallback({ zones }) {
  const W = 1000, H = 480, PAD = 60;
  const lats = zones.map((z) => z.lat), lngs = zones.map((z) => z.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const dx = (maxLng - minLng) || 1, dy = (maxLat - minLat) || 1;
  const X = (lng) => PAD + ((lng - minLng) / dx) * (W - 2 * PAD);
  const Y = (lat) => PAD + ((maxLat - lat) / dy) * (H - 2 * PAD);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', background: 'var(--card)', borderRadius: 6 }} role="img" aria-label="Offline ward survey plot">
      {zones.map((z) => (
        <g key={z.id} style={{ cursor: 'pointer' }} onClick={() => { window.location.href = `/admin/zones/${z.id}`; }}>
          <title>{z.name} — {Number(z.current_score).toFixed(1)} ({z.current_level})</title>
          <circle cx={X(z.lng)} cy={Y(z.lat)} r={15 + Number(z.current_score) * 3} fill={color(z.current_level)} opacity="0.30" />
          <circle cx={X(z.lng)} cy={Y(z.lat)} r="9" fill={color(z.current_level)} opacity="0.9" stroke="#f4f6f0" strokeWidth="2" />
          <text x={X(z.lng)} y={Y(z.lat) - 16} textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="600" fontSize="17" fill="var(--pine)">{z.name}</text>
          <text x={X(z.lng)} y={Y(z.lat) + 6} textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="600" fontSize="15" fill="#f4f6f0">{Number(z.current_score).toFixed(1)}</text>
        </g>
      ))}
    </svg>
  );
}

export function ZoneHeatmap() {
  const [zones, setZones] = useState(null);
  const [center, setCenter] = useState([22.3, 73.18]);
  const [mapDead, setMapDead] = useState(false);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  useEffect(() => {
    const cid = getCityId();
    let stopped = false;
    const load = () => {
      apiClient.get(`/zones?city_id=${cid}`).then((r) => { if (!stopped) { setZones(r.data); setUpdatedAt(new Date()); } }).catch(() => {});
    };
    load();
    getCities().then((cs) => {
      const c = (cs || []).find((x) => x.id === cid);
      if (c && !stopped) setCenter([c.lat, c.lng]);
    }).catch(() => {});
    // Instant push: server emits zones-changed on every report submit/resolve.
    let src = null;
    try {
      src = new EventSource(`${API_BASE}/events`);
      src.addEventListener('zones-changed', () => { setLive(true); load(); });
      src.onerror = () => { try { src.close(); } catch {} src = null; };
    } catch { src = null; }
    // Poll fallback so the view still refreshes if the stream drops.
    const poll = setInterval(load, 30000);
    return () => { stopped = true; clearInterval(poll); try { src && src.close(); } catch {} };
  }, []);
  return (
    <Layout wide>
      <h1 className="display">Zone heatmap</h1>
      <p style={{ color: 'var(--moss)' }}>
        <span title={live ? 'Push-connected: updates arrive instantly' : 'Polling every 30s'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: live ? '#15803d' : '#b45309', display: 'inline-block' }} />
          {live ? 'Live' : 'Syncing'}
        </span>
        {' '}— ward discs resize and recolour as scores change. Select a disc for its file.
        {updatedAt && <span style={{ display: 'block', fontSize: '.85rem' }}>Last sync {updatedAt.toLocaleTimeString()}</span>}
      </p>
      {zones === null ? <Skeleton n={4} /> : zones.length === 0 ? (
        <EmptyState title="No zones in this city yet" hint="Plant the first ward, then watch it score." action={<a className="btn btn-paint" href="/admin/zones/new">Add zone</a>} />
      ) : mapDead ? (
        <>
          <div className="card" role="status" style={{ borderColor: 'var(--med)', marginBottom: '1rem' }}>
            The live street layer could not start here (WebGL or map data blocked) — showing the offline survey plot. Ward data below is unaffected.
          </div>
          <div className="card" style={{ padding: '.75rem' }}><SurveyFallback zones={zones} /></div>
        </>
      ) : (
        <div className="card" style={{ padding: '.75rem' }}>
          <LiveMap zones={zones} center={center} onMapDead={() => setMapDead(true)} />
        </div>
      )}
      {zones !== null && zones.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          {zones.slice().sort((a, b) => b.current_score - a.current_score).map((z) => (
            <a key={z.id} href={`/admin/zones/${z.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 6, textDecoration: 'none', color: 'inherit' }}>
              <span className="pin" style={{ background: color(z.current_level) }} />{z.name}
              <span style={{ marginLeft: 'auto' }}><HazardBadge level={z.current_level} /></span>
            </a>
          ))}
        </div>
      )}
    </Layout>
  );
}
