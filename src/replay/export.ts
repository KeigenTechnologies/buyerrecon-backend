import pool from '../db/client.js';
import { createWriteStream, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { mkdir } from 'fs/promises';
import { join } from 'path';

export async function exportReplay(
  siteId: string,
  windowStart: string,
  windowEnd: string,
  outputDir: string,
): Promise<{ eventsPath: string; metaPath: string }> {
  await mkdir(outputDir, { recursive: true });

  const baseName = `${siteId}_${windowStart}_${windowEnd}`;
  const eventsPath = join(outputDir, `${baseName}.events.jsonl`);
  const metaPath = join(outputDir, `${baseName}.meta.json`);

  const result = await pool.query(
    `SELECT event_id, received_at, collector_version, raw
     FROM accepted_events
     WHERE site_id = $1 AND received_at >= $2::timestamptz AND received_at <= $3::timestamptz
     ORDER BY client_timestamp_ms ASC, received_at ASC, event_id ASC`,
    [siteId, `${windowStart}T00:00:00Z`, `${windowEnd}T23:59:59Z`],
  );

  const hash = createHash('sha256');
  const stream = createWriteStream(eventsPath);
  const sessions = new Set<string>();
  const subjects = new Set<string>();
  const collectorVersions = new Set<string>();

  for (const row of result.rows) {
    const raw = row.raw as Record<string, unknown>;
    const line = JSON.stringify({
      _replay: {
        event_id: parseInt(row.event_id, 10),
        received_at: row.received_at.toISOString(),
        collector_version: row.collector_version,
      },
      ...raw,
    });
    stream.write(line + '\n');
    hash.update(line + '\n');
    if (raw.anon_session_id) sessions.add(raw.anon_session_id as string);
    if (raw.anon_browser_id) subjects.add(raw.anon_browser_id as string);
    collectorVersions.add(row.collector_version);
  }

  stream.end();
  await new Promise<void>((resolve) => stream.on('finish', resolve));

  const meta = {
    export_version: '1.0.0',
    site_id: siteId,
    window_start: `${windowStart}T00:00:00Z`,
    window_end: `${windowEnd}T23:59:59Z`,
    event_count: result.rows.length,
    session_count: sessions.size,
    subject_count: subjects.size,
    exported_at: new Date().toISOString(),
    sort_order: ['client_timestamp_ms', 'received_at', 'event_id'],
    collector_versions: Array.from(collectorVersions),
    sha256: hash.digest('hex'),
  };

  writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  return { eventsPath, metaPath };
}
