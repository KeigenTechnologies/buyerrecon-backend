import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { DEFAULT_CONFIG_272, DEFAULT_CONFIG_750 } from './defaults.js';

const router = Router();

router.get('/config/:siteId', async (req: Request, res: Response) => {
  const { siteId } = req.params;

  try {
    const configResult = await pool.query(
      'SELECT config_272, config_750, deploy_start_date FROM site_configs WHERE site_id = $1',
      [siteId],
    );

    const row = configResult.rows[0];
    const config272 = row ? { ...DEFAULT_CONFIG_272, ...row.config_272 } : DEFAULT_CONFIG_272;
    let config750 = row ? { ...DEFAULT_CONFIG_750, ...row.config_750 } : DEFAULT_CONFIG_750;

    // All 5 sites config-gated equally. Enablement controlled via site_configs table.

    // D1: Compute bootstrap status (backend owns this, probe only consumes)
    const sessionCountResult = await pool.query(
      `SELECT COUNT(DISTINCT session_id) as count
       FROM accepted_events
       WHERE site_id = $1 AND event_type = 'session_start'`,
      [siteId],
    );
    const eligibleSessions = parseInt(sessionCountResult.rows[0]?.count ?? '0', 10);

    const deployStart = row?.deploy_start_date;
    const runtimeDays = deployStart
      ? Math.floor((Date.now() - new Date(deployStart).getTime()) / 86400000)
      : 0;

    const requiredDays = config750.bootstrap?.min_runtime_days ?? 14;
    const requiredSessions = config750.bootstrap?.min_eligible_sessions ?? 500;

    const bootstrapStatus = {
      bootstrap_met: runtimeDays >= requiredDays && eligibleSessions >= requiredSessions,
      runtime_days: runtimeDays,
      eligible_sessions: eligibleSessions,
      required_runtime_days: requiredDays,
      required_eligible_sessions: requiredSessions,
    };

    res.json({
      site_id: siteId,
      config_272: config272,
      config_750: config750,
      bootstrap_status: bootstrapStatus,
    });
  } catch (err) {
    console.error('Config fetch error:', err);
    res.status(500).json({ error: 'config fetch error' });
  }
});

export default router;
