import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient.js';
import { Layout, HazardBadge, Skeleton } from '../ui/components.jsx';

const cell = (l) =>
  l === 'High'
    ? { background: 'var(--high)', color: '#fff' }
    : l === 'Medium'
      ? { background: 'var(--med)', color: '#fff' }
      : { background: 'var(--low)', color: '#fff' };

export function Landing() {
  const [zones, setZones] = useState(null);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    apiClient.get('/zones').then((r) => setZones(r.data)).catch(() => setZones([]));
    apiClient.get('/stats').then((r) => setStats(r.data)).catch(() => setStats(null));
  }, []);
  const ranked = (zones || []).slice().sort((a, b) => b.current_score - a.current_score);
  const worst = ranked[0];

  return (
    <Layout wide>
      {/* Hero — the city readout */}
      <section className="panel-hero rise">
        <p className="kicker" style={{ color: '#b9c4b4' }}>Hazard Rage · city waste monitoring</p>
        <h1 className="display">Know every pile in the city.</h1>
        <p className="lede">
          Citizens pin waste with a photo. The Hazard Engine scores each ward from zero to ten.
          Anything at seven or above pages the sanitation crew on its own.
        </p>
        <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <a className="btn btn-paint" href="/register">File a report</a>
          <a className="btn" style={{ borderColor: '#e9ece5', color: '#e9ece5', background: 'transparent' }} href="/login">Officer sign in</a>
        </div>
        <div style={{ display: 'flex', gap: '2.5rem', marginTop: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div className="score-readout">
              {zones === null ? '––' : worst ? Number(worst.current_score).toFixed(1) : '0.0'}<small> / 10</small>
            </div>
            <div style={{ color: '#b9c4b4' }}>highest ward right now{worst ? ` — ${worst.name}` : ''}</div>
          </div>
          <div className="mono" style={{ fontSize: '1.05rem', display: 'grid', gap: '.15rem' }}>
            <div>{stats === null ? '··' : stats.reports} reports filed</div>
            <div>{stats === null ? '··' : stats.activeAlerts} alerts open</div>
            <div>{stats === null ? '··' : stats.zones} wards on the survey</div>
          </div>
        </div>
      </section>

      {/* Ward grid — the whole city at a glance */}
      <section style={{ marginTop: '2.5rem' }}>
        <p className="kicker">The wards, live</p>
        {!zones ? <Skeleton n={4} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {ranked.map((z) => (
              <div key={z.id} title={`${z.name}: ${Number(z.current_score).toFixed(1)} (${z.current_level})`}
                style={{ ...cell(z.current_level), borderRadius: 6, padding: '.6rem .7rem' }}>
                <div style={{ fontWeight: 700, fontSize: '.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{z.name}</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 600 }}>{Number(z.current_score).toFixed(1)}</div>
              </div>
            ))}
          </div>
        )}
        <p className="lede" style={{ marginTop: '.75rem' }}>Colour is the rating, size of the number is the urgency. Cells refresh as reports land.</p>
      </section>

      {/* How a report becomes a cleanup */}
      <section id="how" style={{ marginTop: '2.5rem' }}>
        <p className="kicker">How a report becomes a cleanup</p>
        <div style={{ borderTop: '2px solid var(--pine)' }}>
          {[
            ['Report', 'A citizen pins a dump with a photo and waste type. Sixty seconds, no training, status tracked to resolution.'],
            ['Score', 'Volume, toxicity, spread, frequency and backlog collapse into a single number per ward.'],
            ['Respond', 'Crews read the heatmap, get paged at seven, and the reporter sees the zone recover.'],
          ].map(([title, body]) => (
            <div key={title} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid var(--rule)' }}>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>{title}</strong>
              <span style={{ color: 'var(--moss)' }}>{body}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Engine */}
      <section style={{ marginTop: '2.5rem' }}>
        <p className="kicker">The engine, in the open</p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div className="card">
            <strong>One formula, every ward</strong>
            <pre className="mono" style={{ background: 'var(--pine)', color: '#e9ece5', padding: '1rem', borderRadius: 6, overflowX: 'auto', fontSize: '.85rem' }}>
HS = .30·volume + .25·toxicity{'\n'}   + .20·spread + .15·frequency{'\n'}   + .10·backlog</pre>
            <div style={{ color: 'var(--moss)' }}>Each input normalised 0–10. Low 0–3, medium 4–6, alert at 7+.</div>
          </div>
          <div className="card">
            <strong>What officers get</strong>
            <div style={{ display: 'grid', gap: '.5rem', marginTop: '.5rem' }}>
              <div>◼ Live heatmap with click-through ward files</div>
              <div>◼ Thirty-day trend bars per ward</div>
              <div>◼ Likely-cause analysis and recommended action</div>
              <div>◼ One-click CSV export for review meetings</div>
            </div>
            <div style={{ marginTop: '1rem' }}><a className="btn btn-primary" href="/login">Open the command center</a></div>
          </div>
        </div>
      </section>

      {/* Live table */}
      <section style={{ marginTop: '2.5rem' }}>
        <p className="kicker">Today across the wards</p>
        {!zones ? <Skeleton /> : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="ledger">
              <thead><tr><th>Zone</th><th>Score</th><th>Rating</th></tr></thead>
              <tbody>{ranked.slice(0, 8).map((z) => (
                <tr key={z.id}><td><strong>{z.name}</strong></td><td className="mono">{Number(z.current_score).toFixed(1)}</td><td><HazardBadge level={z.current_level} /></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: '1rem' }}><a className="btn btn-paint" href="/register">Help clean your ward</a></div>
      </section>

      <footer style={{ marginTop: '3rem', borderTop: '2px solid var(--pine)', paddingTop: '1rem', color: 'var(--moss)', fontSize: '.9rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <span>Hazard Rage — a KPGU capstone project</span>
        <span className="mono">React · Express · PostgreSQL + PostGIS · Redis</span>
        <span style={{ marginLeft: 'auto' }}>Demo: citizen@hazard.local / admin@hazard.local · password123</span>
      </footer>
    </Layout>
  );
}
