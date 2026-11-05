/* Corner Office - Pollinations API layer.
 * Bring Your Own Pollen: device flow (offers the `keys` scope so the app can
 * create private prompt agents on the USER's account). The sk_ key stays in
 * sessionStorage only. Every chat call is billed to the user's own Pollen.
 */
(function () {
  const ENTER = 'https://enter.pollinations.ai';
  const GEN = 'https://gen.pollinations.ai';
  // Filled at deploy time with the publishable app key (pk_) from the owner's dashboard.
  const APP_KEY = window.POLLI_APP_KEY || 'pk_scUmtZsYAPW7Gbi8';
  const BASE_MODEL = 'openai/gpt-5.4-nano'; // cheap default; user-side cost is theirs to cap
  const AGENT_PREFIX = 'corner-office';

  const store = {
    get key() { return sessionStorage.getItem('co_sk') || null; },
    set key(v) { v ? sessionStorage.setItem('co_sk', v) : sessionStorage.removeItem('co_sk'); },
    get owner() { return sessionStorage.getItem('co_owner') || null; },
    set owner(v) { v ? sessionStorage.setItem('co_owner', v) : sessionStorage.removeItem('co_owner'); },
  };

  let pollAbort = null;

  async function startDeviceFlow() {
    const r = await fetch(`${ENTER}/api/device/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: APP_KEY }),
    });
    if (!r.ok) throw new Error(`device code request failed (${r.status})`);
    return r.json(); // { device_code, user_code, verification_uri, verification_uri_complete, expires_in, interval }
  }

  // Returns sk_ key. onStatus(msg) reports progress. Throws on denial/timeout/cancel.
  function pollForToken(deviceCode, intervalSec, onStatus, expiresIn = 1800) {
    return new Promise((resolve, reject) => {
      let done = false, timer, delay = Math.max(1, intervalSec || 5) * 1000;
      const deadline = Date.now() + expiresIn * 1000;
      const finish = (error, value) => { if (done) return; done = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
      pollAbort = () => finish(new Error('cancelled'));
      const tick = async () => {
        if (done) return;
        if (Date.now() >= deadline) return finish(new Error('Device code expired. Start again.'));
        try {
          const r = await fetch(`${ENTER}/api/device/token`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_code: deviceCode }),
          });
          if (done) return;
          const d = await r.json();
          if (r.ok && d.access_token) return finish(null, d.access_token);
          if (!['authorization_pending','slow_down'].includes(d.error)) return finish(new Error(d.error || 'Authorization failed'));
          if (d.error === 'slow_down') delay += 5000;
          onStatus?.('Waiting for approval…');
        } catch { if (!done) onStatus?.('Network unavailable; waiting until the code expires.'); }
        if (!done) timer = setTimeout(tick, delay);
      };
      timer = setTimeout(tick, delay);
    });
  }

  function cancelPolling() { if (pollAbort) pollAbort(); }

  async function api(path, opts = {}) {
    const key = store.key;
    if (!key) throw new Error('not connected');
    const r = await fetch(`${GEN}${path}`, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (r.status === 401) { store.key = null; store.owner = null; throw new Error('Authorization expired or revoked. Reconnect before continuing.'); }
    return { ok: r.ok, status: r.status, data };
  }

  async function fetchProfile() {
    const r = await api('/account/profile');
    if (!r.ok) return null;
    const d = r.data || {};
    return d.githubUsername || null;
  }

  async function fetchBalance() {
    const r = await api('/account/balance');
    if (!r.ok) return null;
    const d = r.data || {};
    // tolerate several shapes
    const b = d.balance ?? d.pollen ?? (d.data && d.data.balance);
    return typeof b === 'number' ? b : null;
  }

  // Probe whether the key carries account:keys (agent management).
  async function canManageAgents() {
    const r = await api('/account/agents');
    if (!r.ok && r.status !== 403) throw new Error('Agent permission check failed; no account changes made.');
    return r.ok;
  }

  async function listAgents() {
    const r = await api('/account/agents');
    if (!r.ok) throw new Error(`list agents failed (${r.status})`);
    return (r.data && r.data.data) || [];
  }

  async function createAgent({ name, title, systemPrompt, description }) {
    const r = await api('/account/agents', {
      method: 'POST',
      body: JSON.stringify({
        name, title, systemPrompt, description: description || '',
        baseModel: BASE_MODEL, visibility: 'private',
        requiredSafetyFeatures: ['privacy', 'secrets'],
      }),
    });
    if (!r.ok) throw new Error(`create agent ${name} failed (${r.status}): ${'Request rejected; check your dashboard'}`);
    return r.data;
  }

  async function keyBudget(allowZero = false) {
    const r = await api('/account/key');
    const b = r.data?.pollenBudget;
    if (!r.ok || !r.data?.valid || !Number.isFinite(b) || b < 0 || (!allowZero && b === 0)) throw new Error('A valid key with a positive finite Pollen budget is required. Reconnect and set a budget.');
    return b;
  }

  // One agent run. Returns { text, receipt }.
  async function runAgent({ model, prompt, jobLabel }) {
    if (!model) throw new Error('Floor agent is not ready; no paid call made.');
    const before = await keyBudget();
    const r = await api('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model, max_tokens: 512, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) {
      const msg = `Call failed (HTTP ${r.status}). No automatic retry; verify usage in your dashboard.`;
      throw new Error(`${jobLabel || model}: ${String(msg).slice(0, 180)}`);
    }
    const d = r.data || {};
    const text = d.choices?.[0]?.message?.content ?? '';
    const u = d.usage || {};
    let debit = null;
    try { const remaining = await keyBudget(true); if (remaining < before) debit = +(before - remaining).toFixed(10); } catch {}
    const receipt = {
      time: new Date().toISOString(),
      job: jobLabel || '',
      agent: model,
      promptTokens: u.prompt_tokens ?? null,
      completionTokens: u.completion_tokens ?? null,
      cost: debit, costBasis: 'observed key-budget debit, not per-call attribution',
    };
    return { text, receipt };
  }

  window.Polli = {
    APP_KEY, BASE_MODEL, AGENT_PREFIX, store,
    startDeviceFlow, pollForToken, cancelPolling,
    fetchProfile, fetchBalance, canManageAgents, listAgents, createAgent, runAgent,
  };
})();
