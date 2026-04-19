import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { hashEmail, encryptEmail, classifyEmail } from './encrypt.js';
import { validateCapturePayload } from './validate.js';

const router = Router();

router.post('/probe/capture', async (req: Request, res: Response) => {
  const v = validateCapturePayload(req.body);
  if (!v.valid) { res.status(400).json({ ok: false, error: v.error }); return; }

  const key = process.env.PROBE_ENCRYPTION_KEY;
  if (!key) { res.status(500).json({ ok: false, error: 'encryption not configured' }); return; }

  const { email, site_id, session_id, browser_id, asset_key,
          trigger_score, trigger_confidence, trigger_reasons,
          config_version, probe_version } = req.body;
  const emailLower = email.toLowerCase().trim();
  const domain = emailLower.split('@')[1];

  try {
    await pool.query(
      `INSERT INTO probe_captures
       (site_id, session_id, browser_id, email_hash, email_domain, email_class,
        email_encrypted, asset_key, trigger_score, trigger_confidence, trigger_reasons,
        config_version, probe_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (site_id, email_hash) DO NOTHING`,
      [site_id, session_id, browser_id ?? '', hashEmail(emailLower), domain,
       classifyEmail(domain), encryptEmail(emailLower, key), asset_key,
       trigger_score, trigger_confidence ?? 0, trigger_reasons ?? [],
       config_version, probe_version],
    );

    const cfg = await pool.query('SELECT config_750 FROM site_configs WHERE site_id = $1', [site_id]);
    const downloadUrl = cfg.rows[0]?.config_750?.asset_url ?? `/assets/downloads/${asset_key}.pdf`;
    res.json({ ok: true, download_url: downloadUrl });
  } catch (err) {
    console.error('Capture error:', err);
    res.status(500).json({ ok: false, error: 'storage error' });
  }
});

router.post('/probe/decision', async (req: Request, res: Response) => {
  const b = req.body;
  if (!b?.site_id || !b?.session_id || !b?.decision || !b?.config_version || !b?.probe_version) {
    res.status(400).json({ ok: false, error: 'missing required fields' }); return;
  }
  try {
    await pool.query(
      `INSERT INTO probe_decisions
       (site_id, session_id, browser_id, decision, trigger_score, trigger_confidence,
        trigger_threshold, trigger_reasons, safety_result, safety_reason,
        page_path, page_group, config_version, probe_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [b.site_id, b.session_id, b.browser_id ?? '', b.decision,
       b.trigger_score ?? 0, b.trigger_confidence ?? 0, b.trigger_threshold ?? 0,
       b.trigger_reasons ?? [], b.safety_result ?? null, b.safety_reason ?? null,
       b.page_path ?? null, b.page_group ?? null, b.config_version, b.probe_version],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Decision log error:', err);
    res.status(500).json({ ok: false, error: 'storage error' });
  }
});

export default router;
