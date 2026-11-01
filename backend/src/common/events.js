// In-process event bus for live UI pushes (single-instance realtime).
// Payloads are zone IDs only — clients refetch authoritative data via the API.
// (Multi-instance fan-out via Redis pub/sub is the documented scale-up path.)
const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(50);

function zonesChanged(zoneId) {
  try { bus.emit('zones-changed', { zoneId, at: new Date().toISOString() }); } catch {}
}

module.exports = { bus, zonesChanged };
