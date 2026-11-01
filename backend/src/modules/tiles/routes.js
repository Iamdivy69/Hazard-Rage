// Tile proxy — serves cached tiles from backend/uploads/tiles, with fallback across Esri/OSM.
// Disk-cached under backend/uploads/tiles, Cache-Control 7 days.
const express = require('express');
const path = require('path');
const fs = require('fs');
const { asyncHandler } = require('../../common/errors');

const router = express.Router();
const TILE_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'tiles');
fs.mkdirSync(TILE_DIR, { recursive: true });

// 1x1 transparent PNG fallback so Leaflet tile errors never break the display
const FALLBACK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const UPSTREAMS = [
  // 1. Esri World Street Map (high reliability, global coverage, crisp street detail, no API key)
  // Note: Esri endpoint coordinates are /{z}/{y}/{x}
  {
    getUrl: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
    headers: { 'User-Agent': 'HazardRage/1.0 (CityWasteMonitor; contact: dev@hazard.local)' },
  },
  // 2. OpenStreetMap standard tile server
  {
    getUrl: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    headers: { 'User-Agent': 'HazardRage/1.0 (CityWasteMonitor; contact: dev@hazard.local)' },
  },
  // 3. Esri World Topo Map (fallback topographic layer)
  {
    getUrl: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,
    headers: { 'User-Agent': 'HazardRage/1.0 (CityWasteMonitor; contact: dev@hazard.local)' },
  },
];

async function fetchTile(z, x, y) {
  for (const upstream of UPSTREAMS) {
    const url = upstream.getUrl(z, x, y);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: upstream.headers,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      // Carto watermark and empty placeholders are ~2049 bytes or less; real tiles are > 3000 bytes
      if (buf.length > 3000) {
        const ct = res.headers.get('content-type') || '';
        const ext = /jpe?g/.test(ct) || buf[0] === 0xff && buf[1] === 0xd8 ? 'jpg' : 'png';
        return { buf, ext };
      }
    } catch {
      clearTimeout(timer);
    }
  }
  return null;
}

router.get('/:z/:x/:y', asyncHandler(async (req, res) => {
  const z = parseInt(req.params.z, 10);
  const x = parseInt(req.params.x, 10);
  const y = parseInt(req.params.y, 10);
  const max = Math.pow(2, z);
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 19 || x < 0 || y < 0 || x >= max || y >= max) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid tile coordinates' } });
  }

  const serveFile = (file) => {
    res.setHeader('Content-Type', file.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.sendFile(file);
  };

  // 1. Check disk cache
  for (const ext of ['jpg', 'png']) {
    const file = path.join(TILE_DIR, `${z}`, `${x}`, `${y}.${ext}`);
    if (fs.existsSync(file)) {
      const stat = fs.statSync(file);
      // Validate that cached tile isn't a corrupted/placeholder < 3KB file
      if (stat.size > 3000) {
        return serveFile(file);
      } else {
        try { fs.unlinkSync(file); } catch {}
      }
    }
  }

  // 2. Fetch with fallback across upstreams
  const fetched = await fetchTile(z, x, y);
  if (fetched) {
    const file = path.join(TILE_DIR, `${z}`, `${x}`, `${y}.${fetched.ext}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, fetched.buf);
    return serveFile(file);
  }

  // 3. Fallback transparent PNG instead of 502 JSON so Leaflet never crashes
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.send(FALLBACK_PNG);
}));

module.exports = router;
