import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateSessionForUser } from '../_lib/auth.js';
import { onRequestGet, onRequestPost } from './oculomotor-data.js';

const id = '11111111-1111-4111-8111-111111111111';
const subjectId = '22222222-2222-4222-8222-222222222222';
const valid = {
  recordId: id,
  subjectId,
  source: 'webgazer',
  metadata: { mode: 'pursuit', pattern: 'horizontalSweep', eye_tracking_source: 'webgazer', screen_width_px: 1920, duration_ms: 15000 },
  records: [[1, 10, null, 10, 100, 1, 320, 240, 330, 245, 11.18, 0.2, 1, 'training', 'right']],
};

function CreateEnv() {
  const objects = new Map();
  const limits = new Map();
  return {
    AUTH_SESSION_SECRET: '0123456789abcdef0123456789abcdef',
    ANONYMOUS_RECORDS_ENABLED: '1',
    objects,
    REHAB_DB: {
      prepare(sql) {
        return {
          async run() { return { success: true }; },
          bind(...args) {
            return {
              async run() { return { success: true }; },
              async first() {
                if (!/INSERT INTO rate_limits/i.test(sql)) return null;
                const [key, resetAt] = args;
                const count = (limits.get(key) || 0) + 1;
                limits.set(key, count);
                return { count, reset_at: resetAt };
              },
            };
          },
        };
      },
    },
    OCULOMOTOR_DATA: {
      async put(key, csv, options) {
        if (objects.has(key) && options?.onlyIf?.etagDoesNotMatch === '*') return null;
        objects.set(key, { csv, uploaded: new Date(), options });
        return { key };
      },
      async get(key) {
        const value = objects.get(key);
        return value && { body: new Response(value.csv).body, text: async () => value.csv };
      },
      async list({ prefix }) {
        return {
          objects: [...objects.entries()].filter(([key]) => key.startsWith(prefix))
            .map(([key, value]) => ({ key, uploaded: value.uploaded, size: value.csv.length })),
          truncated: false,
        };
      },
    },
  };
}

let ip = 0;
function Post(body, token, env, origin = 'https://trainerhub.cc') {
  return onRequestPost({
    request: new Request('https://trainerhub.cc/api/oculomotor-data', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'X-Forwarded-For': `192.0.2.${++ip}`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
    env,
  });
}

function Get(query, token, env) {
  return onRequestGet({
    request: new Request(`https://trainerhub.cc/api/oculomotor-data${query}`, {
      headers: { Origin: 'https://trainerhub.cc', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }),
    env,
  });
}

test('private R2 CSV stores canonical rows and only the owner can list or read it', async () => {
  const env = CreateEnv();
  const owner = await CreateSessionForUser(env, { id: 'owner' });
  const other = await CreateSessionForUser(env, { id: 'other' });
  assert.equal((await Post(valid, owner, env)).status, 201);
  const key = `users/owner/${id}.csv`;
  const csv = env.objects.get(key).csv;
  assert.match(csv, /^\uFEFF# subject_id,22222222-2222-4222-8222-222222222222\r\n/);
  assert.match(csv, /# mode,pursuit\r\n# pattern,horizontalSweep\r\n# screen_width_px,1920\r\n# duration_ms,15000\r\n/);
  assert.doesNotMatch(csv, /aoi_score|valid_gaze_ms|in_threshold_ms|# score/);
  assert.match(csv, /sample_index,trial_time_ms,device_timestamp_us,delta_t_ms,instant_hz,gaze_valid,gaze_x_px,gaze_y_px,stimulus_x_px,stimulus_y_px,distance_error_px,distance_error_deg,is_within_threshold,phase,direction\r\n/);
  assert.match(csv, /1,10,,10,100,1,320,240,330,245,11\.18,0\.2,1,training,right\r\n$/);
  assert.equal(env.objects.get(key).options.httpMetadata.contentType, 'text/csv; charset=utf-8');
  assert.equal(env.objects.get(key).options.customMetadata.pattern, 'horizontalSweep');
  assert.equal(env.objects.get(key).options.customMetadata.screen_width_px, '1920');
  assert.equal((await Post(valid, owner, env)).status, 201);
  assert.equal(env.objects.size, 1);
  assert.equal((await Post({ ...valid, records: [[1, 10, null, 10, 100, 1, 320, 240, 330, 245, 12, 0.2, 1, 'training', 'right']] }, owner, env)).status, 409);
  assert.equal(env.objects.get(key).csv, csv);
  assert.equal((await Get('', owner, env)).status, 200);
  assert.equal((await Get(`?recordId=${id}`, owner, env)).status, 200);
  assert.equal((await Get('', other, env)).status, 200);
  assert.deepEqual((await (await Get('', other, env)).json()).records, []);
  assert.equal((await Get(`?recordId=${id}`, other, env)).status, 404);
  assert.equal((await Get(`?recordId=${id}`, null, env)).status, 401);
  assert.equal((await Get('?recordId=../../owner', owner, env)).status, 400);
  assert.equal((await Get('?subjectId=22222222-2222-4222-8222-222222222222', owner, env)).status, 400);
});

test('reference drills store physical geometry, validation metadata, and phase rows', async () => {
  const env = CreateEnv();
  const phases = ['cross', 'movement', 'dwell', 'hold', 'vor'];
  const payload = {
    ...valid,
    metadata: {
      ...valid.metadata,
      mode: 'fixation', run_mode: 'evaluation', stimulus_type: 'numbers_dot',
      screen_width_cm: 53, screen_height_cm: 30, viewing_distance_cm: 60,
      css_px_per_cm_y: 36, target_size_arcmin: 60, speed_arcmin_sec: 300,
      validation_error_deg: 2.1, gaze_threshold_deg: 4.2,
    },
    records: phases.map((phase, index) => {
      const row = [...valid.records[0]];
      row[0] = index + 1;
      row[1] = index === 4 ? 400000 : index * 100;
      row[13] = phase;
      return row;
    }),
  };
  assert.equal((await Post(payload, null, env)).status, 201);
  const csv = env.objects.get(`guests/${subjectId}/${id}.csv`).csv;
  assert.match(csv, /# screen_width_cm,53\r\n# screen_height_cm,30\r\n/);
  assert.match(csv, /# validation_error_deg,2\.1\r\n# gaze_threshold_deg,4\.2\r\n/);
  assert.match(csv, /400000[^\r\n]*,vor,right\r\n$/);
});

test('rejects forged, malformed, oversized, and cross-origin uploads before R2', async () => {
  const env = CreateEnv();
  const cases = [
    { ...valid, recordId: '../other/record' },
    { ...valid, subjectId: 'public' },
    { ...valid, source: 'off' },
    { ...valid, metadata: { aoi_score: 100 } },
    { ...valid, metadata: { ...valid.metadata, eye_tracking_source: 'tobii' } },
    { ...valid, metadata: { ...valid.metadata, mode: '=cmd' } },
    { ...valid, records: [[1, 10, null, 10, 100, 1, '=HYPERLINK(1)', 240, 330, 245, 11, 0.2, 1, 'training', 'right']] },
    { ...valid, records: [[1, 10, null, 10, 100, 1, 320, 240, 330, 245, 11, 0.2, 1, 'training', '=cmd']] },
    { ...valid, records: [[1, 10, null, 10, 100, 0, 320, 240, 330, 245, null, null, 0, 'training', 'right']] },
    { ...valid, records: [[2, 10, null, 10, 100, 1, 320, 240, 330, 245, 11, 0.2, 1, 'training', 'right']] },
  ];
  for (const payload of cases) assert.equal((await Post(payload, null, env)).status, 400);
  assert.equal((await Post(valid, 'forged-token', env)).status, 401);
  assert.equal((await Post(valid, null, env, 'https://evil.example')).status, 403);
  assert.equal((await Post({ ...valid, records: Array(36001).fill(valid.records[0]) }, null, env)).status, 400);
  assert.equal(env.objects.size, 0);
});

test('guest CSV stays private and storage failures never report success', async () => {
  const env = CreateEnv();
  assert.equal((await Post(valid, null, env)).status, 201);
  assert.equal(env.objects.has(`guests/${subjectId}/${id}.csv`), true);
  assert.equal((await Get(`?recordId=${id}`, null, env)).status, 401);
  env.OCULOMOTOR_DATA.put = async () => { throw new Error('R2 unavailable'); };
  assert.equal((await Post({ ...valid, recordId: '33333333-3333-4333-8333-333333333333' }, null, env)).status, 503);
  delete env.OCULOMOTOR_DATA;
  assert.equal((await Post(valid, null, env)).status, 503);
});

test('R2 read failures return a retryable status without exposing CSV data', async () => {
  const env = CreateEnv();
  const owner = await CreateSessionForUser(env, { id: 'read-failure-owner' });
  env.OCULOMOTOR_DATA.get = async () => { throw new Error('R2 read unavailable'); };
  env.OCULOMOTOR_DATA.list = async () => { throw new Error('R2 list unavailable'); };
  assert.equal((await Get(`?recordId=${id}`, owner, env)).status, 503);
  assert.equal((await Get('', owner, env)).status, 503);
});

test('maximum five-minute run survives CSV generation without dropping samples', async () => {
  const env = CreateEnv();
  const token = await CreateSessionForUser(env, { id: 'large-run-owner' });
  const records = Array.from({ length: 36000 }, (_, index) => [
    index + 1, index * 8, null, 8, 125, 1, 320, 240, 330, 245, 11.18, 0.2, 1, 'training', 'right',
  ]);
  assert.equal((await Post({ ...valid, records }, token, env)).status, 201);
  const csv = env.objects.get(`users/large-run-owner/${id}.csv`).csv;
  assert.equal(csv.split('\r\n').length, 36000 + 9);
  assert.match(csv, /36000,287992,,8,125,1,320,240,330,245,11\.18,0\.2,1,training,right\r\n$/);
});
