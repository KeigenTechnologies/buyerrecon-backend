import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { validateEvent, validateBatch, redactForPII } from './validate.js';
import { COLLECTOR_VERSION } from '../constants.js';

const router = Router();

router.post('/collect', async (req: Request, res: Response) => {
  const batch = validateBatch(req.body);
  if (!batch.valid) {
    res.status(400).json({ error: batch.error });
    return;
  }

  const events = req.body as unknown[];
  const accepted: Array<[string, string, string, string, string, number, string, string,
    string | null, string | null, string | null, number | null, string]> = [];
  const rejected: Array<[string | null, string, string[], string]> = [];

  for (const raw of events) {
    const r = validateEvent(raw);
    if (r.accepted) {
      accepted.push([
        r.siteId!, r.hostname ?? '', r.eventType!, r.sessionId!,
        r.browserId!, r.clientTimestampMs!, JSON.stringify(raw), COLLECTOR_VERSION,
        r.clientEventId, r.pageViewId, r.previousPageViewId,
        r.eventSequenceIndex, r.eventContractVersion,
      ]);
    } else {
      const storedRaw = r.piiRejected ? JSON.stringify(redactForPII(raw)) : JSON.stringify(raw);
      rejected.push([r.siteId, storedRaw, r.reasonCodes, COLLECTOR_VERSION]);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const a of accepted) {
      await client.query(
        `INSERT INTO accepted_events
         (site_id, hostname, event_type, session_id, browser_id, client_timestamp_ms, raw, collector_version,
          client_event_id, page_view_id, previous_page_view_id, event_sequence_index, event_contract_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (site_id, session_id, client_event_id)
           WHERE client_event_id IS NOT NULL
         DO NOTHING`,
        a,
      );
    }

    for (const r of rejected) {
      await client.query(
        `INSERT INTO rejected_events (site_id, raw, reason_codes, collector_version)
         VALUES ($1, $2, $3, $4)`,
        r,
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Collector insert error:', err);
    res.status(500).json({ error: 'storage error' });
    return;
  } finally {
    client.release();
  }

  res.status(204).end();
});

export default router;
