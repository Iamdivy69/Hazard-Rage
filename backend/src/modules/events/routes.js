const { asyncHandler } = require('../../common/errors');
const { bus } = require('../../common/events');
const express = require('express');

const router = express.Router();

// Public Server-Sent Events stream. Sends only change pings (no data, no PII);
// clients refetch through their authenticated API calls.
router.get('/', asyncHandler(async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
  const onChange = (payload) => {
    try { res.write(`event: zones-changed\ndata: ${JSON.stringify(payload)}\n\n`); } catch {}
  };
  bus.on('zones-changed', onChange);
  const beat = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);
  req.on('close', () => { clearInterval(beat); bus.off('zones-changed', onChange); });
}));

module.exports = router;
