import { createHash } from 'node:crypto';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
export function createLaunchHandler(openStore) {
  return async (request) => {
    if (request.method !== 'POST') return reply(405, { error: 'Use the launch form to subscribe.' });
    if (request.headers.get('origin') !== 'https://filipinawest.com') return reply(403, { error: 'Please use the form on filipinawest.com.' });
    try {
      const text = await request.text();
      if (text.length > 2048) return reply(413, { error: 'Submission too large.' });
      const form = new URLSearchParams(text);
      if (form.get('company-website')) return reply(400, { error: 'Submission could not be accepted.' });
      const email = (form.get('email') || '').trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return reply(400, { error: 'Enter a valid email address.' });
      if (form.get('launch-consent') !== 'yes' || form.get('consent-version') !== 'launch-2026-09-24') return reply(400, { error: 'Please confirm you are 18 or over and agree to launch updates.' });
      const store = openStore();
      const key = createHash('sha256').update(email).digest('hex');
      // Atomic create-only avoids duplicate entries and preserves original consent time.
      await store.setJSON(key, { email, consent: 'launch-and-access-updates', consentVersion: 'launch-2026-09-24', createdAt: new Date().toISOString(), source: 'homepage', testRecord: email.endsWith('@example.com') }, { onlyIfNew: true });
      const saved = await store.get(key, { type: 'json', consistency: 'strong' });
      if (!saved || saved.email !== email || saved.consentVersion !== 'launch-2026-09-24') throw new Error('readback-failed');
      return reply(200, { stored: true, message: 'You are on the launch list. We will email you when launch or access news is available.' });
    } catch {
      return reply(503, { error: 'We could not confirm your signup. Please try again later.' });
    }
  };
}
