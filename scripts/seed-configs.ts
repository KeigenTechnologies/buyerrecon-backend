import 'dotenv/config';
import pool from '../src/db/client.js';
import { DEFAULT_CONFIG_272, DEFAULT_CONFIG_750 } from '../src/config/defaults.js';

const SITES = [
  { site_id: 'buyerrecon_com', overrides: { asset_key: 'ams_whitepaper_v5', asset_url: '/resources/ams-whitepaper-thank-you.html', modal_copy: { headline: 'See how shadow traffic analysis works', body: 'The AMS whitepaper covers the methodology behind buyer behavior detection.', cta_text: 'Download the whitepaper', dismiss_text: 'No thanks' } } },
  { site_id: 'keigen_co_uk', overrides: { asset_key: 'bhf_brief', asset_url: '/forms/thank-you-bhf.html', modal_copy: { headline: 'Get the buyer health framework brief', body: 'A 1-page framework for evaluating buyer quality signals.', cta_text: 'Get the brief', dismiss_text: 'No thanks' } } },
  { site_id: 'fidcern_com', overrides: { asset_key: 'verification_baseline', asset_url: '/get-my-verification-baseline/', modal_copy: { headline: 'Get your verification baseline', body: 'See how your current confidence scoring compares to industry benchmarks.', cta_text: 'Get my baseline', dismiss_text: 'No thanks' } } },
  { site_id: 'realbuyergrowth_com', overrides: { asset_key: 'buyer_quality_snapshot', asset_url: '/uk/snapshot/', modal_copy: { headline: 'See your buyer quality snapshot', body: 'A quick diagnostic of your current buyer signal quality.', cta_text: 'Get the snapshot', dismiss_text: 'No thanks' } } },
  { site_id: 'timetopoint_com', overrides: { enabled: false } },
];

async function seed() {
  for (const s of SITES) {
    const config750 = { ...DEFAULT_CONFIG_750, ...s.overrides };
    if (s.site_id === 'timetopoint_com') config750.enabled = false;
    await pool.query(
      `INSERT INTO site_configs (site_id, config_272, config_750)
       VALUES ($1, $2, $3)
       ON CONFLICT (site_id) DO UPDATE SET config_272 = $2, config_750 = $3, updated_at = NOW()`,
      [s.site_id, JSON.stringify(DEFAULT_CONFIG_272), JSON.stringify(config750)],
    );
    console.log(`Seeded: ${s.site_id}`);
  }
  await pool.end();
}

seed().catch(console.error);
