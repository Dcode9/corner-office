/* Corner Office - app orchestrator. */
(function () {
  const $ = (id) => document.getElementById(id);
  const P = window.Polli, D = window.CO_DEMO, T = window.Tower3D;

  // ---------- state ----------
  let mode = null;            // null | 'live' | 'replay'
  let owner = null;           // github handle (live)
  let canAgents = false;      // key has account:keys (live)
  let sessionSpend = 0;       // pollen, live mode
  let capAcked = false;       // owner chose to continue past the cap this run
  const SESSION_CAP = 1;      // pollen; pause workday past this unless owner continues

  const blank = () => ({ floors: [], receipts: [], decisions: [], seq: 0 });
  let state = blank();
  let replay = blank();

  function save() { try { sessionStorage.setItem('co_state_' + owner, JSON.stringify(state)); } catch {} }
  function load() { try { const s = JSON.parse(sessionStorage.getItem('co_state_' + owner)); if (s && s.floors) state = s; } catch {} }
  const S = () => (mode === 'replay' ? replay : state);
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);

  let paidBusy = false, costUnknown = false;
  async function paidCall(f, prompt, jobLabel) {
    if (paidBusy) throw new Error('Another call is in progress. Wait for it to finish.');
    if (costUnknown) throw new Error('Spending paused: the last charge is unknown. Check your Pollinations usage before reconnecting.');
    if (!P.store.key) throw new Error('Reconnect before running jobs.');
    if (canAgents && !f.agentModel) throw new Error('Floor agent creation failed or is not ready. Reconnect to retry setup.');
    if (sessionSpend >= SESSION_CAP && !capAcked) {
      if (!confirm(`Recorded session charges reached ${sessionSpend.toFixed(4)} Pollen. This is a pause threshold, not a hard cap. Continue?`)) throw new Error('Paused at the session threshold.');
      capAcked = true;
    }
    paidBusy = true;
    try {
      const r = await P.runAgent({model: canAgents ? f.agentModel : P.BASE_MODEL, prompt, jobLabel});
      if (r.receipt.cost == null) costUnknown = true;
      else sessionSpend += r.receipt.cost;
      return r;
    } catch (e) { costUnknown = true; throw e; }
    finally { paidBusy = false; sessionStorage.setItem('co_guard_' + owner, JSON.stringify({costUnknown, sessionSpend})); }
  }

  // ---------- seed floors ----------
  function seedFloors(target) {
    target.floors = D.companies.map((c, i) => ({
      id: 'f' + i, name: c.name, tagline: c.tagline, business: c.business,
      agentName: `${P.AGENT_PREFIX}-${slug(c.name)}`,
      active: false, jobs: [],
    }));
  }

  // ---------- routing ----------
  const views = { tower: 'view-tower', office: 'view-office', directory: 'view-directory', receipts: 'view-receipts' };
  function route() {
    const h = location.hash || '#/tower';
    const m = h.match(/^#\/(tower|directory|receipts)(?:\?.*)?$/) || h.match(/^#\/floor\/(\d+)$/);
    let v = 'tower';
    if (m) v = m[1] !== undefined && h.startsWith('#/floor/') ? 'office' : m[1];
    Object.entries(views).forEach(([k, id]) => $(id).classList.toggle('hidden', k !== v));
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === v));
    if (v === 'office') renderOffice(parseInt(h.match(/^#\/floor\/(\d+)$/)[1], 10));
    if (v === 'directory') renderDirectory();
    if (v === 'receipts') renderReceipts();
  }

  // ---------- tower ----------
  function rebuildTower() {
    T.build(S().floors.map(f => ({ name: f.name, active: f.active })));
    S().floors.forEach((f, i) => { T.setLit(i, f.active); });
  }

  T.onFloorClick((f, i) => { T.select(i); location.hash = `#/floor/${i}`; });

  // ---------- rendering ----------
  function logLine(html) {
    const li = document.createElement('li');
    li.innerHTML = html;
    $('day-log').prepend(li);
  }

  function renderDecisions() {
    const list = $('decision-list');
    const dec = S().decisions.filter(d => !d.resolved);
    list.innerHTML = '';
    dec.forEach(d => {
      const li = document.createElement('li');
      li.innerHTML = `<h4>${esc(d.floorName)}</h4><div>${esc(d.question)}</div>
        <div class="meta">raised ${new Date(d.time).toLocaleTimeString()}</div>
        <div class="decision-actions">
          <button class="btn btn-approve" data-approve="${d.id}">Approve</button>
          <button class="btn btn-reject" data-reject="${d.id}">Reject</button>
        </div>`;
      list.appendChild(li);
    });
    $('decision-count').classList.toggle('hidden', dec.length === 0);
    $('decision-count').textContent = dec.length;
  }

  function renderOffice(i) {
    const f = S().floors[i];
    if (!f) { location.hash = '#/tower'; return; }
    $('office-name').textContent = f.name;
    $('office-tagline').textContent = f.tagline || f.business;
    $('office-floor-label').textContent = `Floor ${i + 1}`;
    const al = $('agent-list');
    al.innerHTML = '';
    if (mode === 'live' && canAgents) {
      const li = document.createElement('li');
      li.innerHTML = `<h4><span class="badge-role">agent</span>${esc(f.agentName)}</h4>
        <div class="meta">private prompt agent on your Pollinations account · base ${P.BASE_MODEL} · runs on your Pollen</div>`;
      al.appendChild(li);
    } else if (mode === 'live') {
      const li = document.createElement('li');
      li.innerHTML = `<h4><span class="badge-role">no keys scope</span>agent-less mode</h4>
        <div class="meta">your key has no <code>keys</code> permission, so this floor runs plain model calls on your Pollen - no agents were created. Re-connect and tick <code>keys</code> to give this floor its own agent.</div>`;
      al.appendChild(li);
    } else {
      const li = document.createElement('li');
      li.innerHTML = `<h4><span class="badge-role">replay</span>sample agent</h4><div class="meta">scripted sample - connect your Pollen to run a real one</div>`;
      al.appendChild(li);
    }
    const jl = $('job-list');
    jl.innerHTML = '';
    (f.jobs || []).slice().reverse().forEach(j => {
      const li = document.createElement('li');
      li.innerHTML = `<h4><span class="badge-role">${esc(j.role)}</span>${esc(j.title)}</h4>
        <div>${esc(j.text)}</div><div class="meta">${new Date(j.time).toLocaleString()}${j.cost != null ? ` · ${j.cost} Pollen` : ''}</div>`;
      jl.appendChild(li);
    });
    if (!(f.jobs || []).length) jl.innerHTML = '<li class="meta">No jobs yet - run a workday from the tower view.</li>';
  }

  function renderDirectory() {
    const dl = $('directory-list');
    dl.innerHTML = '';
    S().floors.forEach((f, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<h4>${esc(f.name)}</h4><div>${esc(f.tagline || f.business)}</div>
        <div class="meta">Floor ${i + 1} · ${(f.jobs || []).length} jobs run ${f.active ? '· active' : ''}</div>`;
      dl.appendChild(li);
    });
  }

  function renderReceipts() {
    const tb = document.querySelector('#receipts-table tbody');
    const rs = S().receipts;
    tb.innerHTML = '';
    rs.slice().reverse().forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${new Date(r.time).toLocaleTimeString()}</td><td>${esc(r.floorName || '')}</td>
        <td>${esc(r.job)}</td><td><code>${esc(r.agent)}</code></td>
        <td>${r.promptTokens ?? '—'} / ${r.completionTokens ?? '—'}</td>
        <td>${r.cost != null ? r.cost : '—'}</td>`;
      tb.appendChild(tr);
    });
    const total = rs.reduce((a, r) => a + (Number.isFinite(r.cost) ? r.cost : 0), 0);
    const unknown = rs.filter(r => r.cost == null).length;
    $('receipts-summary').innerHTML = `
      <div class="stat"><b>${rs.length}</b>agent calls</div>
      <div class="stat"><b>${total.toFixed(6)}</b>Pollen ${mode === 'replay' ? '(sample)' : 'recorded; ' + unknown + ' charge(s) unknown'}</div>
      <div class="stat"><b>${S().floors.reduce((a, f) => a + (f.jobs || []).length, 0)}</b>jobs completed</div>
      ${mode === 'replay' ? '<div class="stat"><b>replay</b>sample data - nothing was spent</div>' : ''}`;
    $('nav-receipt-count').classList.toggle('hidden', rs.length === 0);
    $('nav-receipt-count').textContent = rs.length;
  }

  // ---------- workday ----------
  const ROLES = [
    { role: 'research', prompt: (f) => `Draft 2-4 research hypotheses for a ${f.business} business. You have no live research tools. Label assumptions and suggest sources to verify; do not invent findings. Under 120 words.` },
    { role: 'build', prompt: (f) => `Turn today's research into one concrete deliverable for this ${f.business} company (a draft, plan, or copy). Under 150 words.` },
    { role: 'report', prompt: (f) => `Write the day summary for the owner, under 80 words. If a human decision is genuinely needed, end with a line exactly like: DECISION: <the question>` },
  ];

  let running = false;
  async function runWorkday() {
    if (running) return;
    running = true;
    $('btn-run-day').disabled = true;
    $('day-progress').classList.remove('hidden');
    const floors = S().floors;
    const total = floors.length * ROLES.length;
    let done = 0;
    for (let i = 0; i < floors.length; i++) {
      const f = floors[i];
      T.setWorking(i, true);
      for (const { role, prompt } of ROLES) {
        try {
          let text, receipt;
          if (mode === 'live') {
            const prior = f.jobs.slice(-3).map(j => `${j.role}: ${j.text}`).join('\n');
            const r = await paidCall(f, prompt(f) + (prior ? '\nEarlier work:\n' + prior : ''), `${f.name} · ${role}`);
            text = r.text; receipt = r.receipt;

          } else {
            await sleep(350);
            const step = D.dayScript.find(s => s.floor === i && s.role === role);
            text = step ? step.text : '(sample)';
            receipt = D.receiptFor(role, f.name, S().seq++);
          }
          receipt.floorName = f.name;
          S().receipts.push(receipt);
          f.jobs.push({ role, title: `${role} - ${new Date().toLocaleDateString()}`, text, time: new Date().toISOString(), cost: receipt.cost });
          // decision?
          let dec = null;
          if (mode === 'replay') {
            const step = D.dayScript.find(s => s.floor === i && s.role === role);
            if (step && step.decision) dec = step.decision;
          } else {
            const m = text.match(/DECISION:\s*(.+)/i);
            if (m) { dec = m[1].trim(); text = text.replace(/\n?\s*DECISION:.*$/is, '').trim(); }
          }
          if (dec) {
            S().decisions.push({ id: 'd' + (++S().seq), floorIndex: i, floorName: f.name, question: dec, time: new Date().toISOString(), resolved: null });
            logLine(`<b>${esc(f.name)}</b> needs your decision`);
          }
          logLine(`<b>${esc(f.name)}</b> ${role} done${receipt.cost != null ? ` (${receipt.cost} Pollen)` : ''}`);
        } catch (e) {
          logLine(`<b>${esc(f.name)}</b> ${role} stopped: ${esc(e.message)}`);
          if (mode === 'live') { running = false; T.setWorking(i, false); $('btn-run-day').disabled = false; renderReceipts(); save(); return; }
        }
        done++;
        $('day-progress-bar').style.width = `${(done / total) * 100}%`;
        renderDecisions();
        if (mode === 'live') save();
      }
      T.setWorking(i, false);
      T.setLit(i, true);
      f.active = true;
    }
    if (mode === 'live') save();
    renderReceipts();
    running = false;
    $('btn-run-day').disabled = mode === null;
    logLine('<b>Workday complete</b> - check the decision inbox and receipts.');
  }

  // ---------- decisions ----------
  document.addEventListener('click', async (e) => {
    const ap = e.target.dataset.approve, rj = e.target.dataset.reject;
    if (!ap && !rj) return;
    const d = S().decisions.find(x => x.id === (ap || rj));
    if (!d || d.resolved || running || paidBusy) return;
    d.resolved = ap ? 'approved' : 'rejected';
    logLine(`<b>${esc(d.floorName)}</b>: you ${d.resolved} "${esc(d.question.slice(0, 60))}"`);
    if (mode === 'live' && ap) {
      const f = S().floors[d.floorIndex];
      try {
        if (!confirm('Approve and request a paid follow-up note from your Pollen? This does not execute the business action.')) { d.resolved = null; renderDecisions(); return; }
        const r = await paidCall(f, `The owner approved this decision: "${d.question}". Write a short follow-up note only. Do not send messages or take external actions.`, `${f.name} · follow-up`);
        r.receipt.floorName = f.name;
        S().receipts.push(r.receipt);

        f.jobs.push({ role: 'follow-up', title: 'approved decision follow-up', text: r.text, time: new Date().toISOString(), cost: r.receipt.cost });
      } catch (err) { logLine(`Follow-up failed: ${esc(err.message)}`); }
    }
    save(); renderDecisions(); renderReceipts();
  });

  // ---------- connect ----------
  $('btn-connect').addEventListener('click', () => { $('modal-consent').showModal(); $('modal-consent').scrollTop = 0; });
  $('btn-consent-cancel').addEventListener('click', () => $('modal-consent').close());
  $('btn-device-cancel').addEventListener('click', () => { P.cancelPolling(); $('modal-device').close(); });

  $('btn-consent-go').addEventListener('click', async () => {
    if (running || paidBusy) return;
    $('modal-consent').close();
    try {
      const d = await P.startDeviceFlow();
      $('device-link').href = d.verification_uri_complete;
      $('device-link').textContent = d.verification_uri_complete;
      $('device-code').textContent = d.user_code;
      $('device-status').textContent = 'Waiting for approval…';
      $('modal-device').showModal();
      const key = await P.pollForToken(d.device_code, d.interval, (s) => { $('device-status').textContent = s; }, d.expires_in);
      P.store.key = key;
      $('modal-device').close();
      await finishConnect();
    } catch (e) {
      $('modal-device').close();
      if (e.message !== 'cancelled') alert('Connect failed: ' + e.message);
    }
  });

  async function finishConnect() {
    owner = await P.fetchProfile();
    if (!owner) throw new Error('A linked GitHub username is required; setup stopped.');
    P.store.owner = owner;
    try { const guard = JSON.parse(sessionStorage.getItem('co_guard_' + owner)); if (guard) { costUnknown = !!guard.costUnknown; sessionSpend = Number.isFinite(guard.sessionSpend) ? guard.sessionSpend : 0; } } catch {}
    canAgents = await P.canManageAgents();
    const bal = await P.fetchBalance();
    if (bal != null) {
      $('balance-chip').textContent = `${bal.toFixed(2)} Pollen`;
      $('balance-chip').classList.remove('hidden');
    }
    mode = 'live';
    state = blank(); load();
    if (!state.floors.length) seedFloors(state);
    rebuildTower();
    // create floor agents if we may and haven't yet
    if (canAgents) {
      logLine('<b>Connected</b> with keys permission - raising your tower agents…');
      const existing = new Map((await P.listAgents()).map(a => [a.name, a]));
      for (const f of state.floors) {
        f.agentModel = null;
        if (existing.has(f.agentName)) { f.agentModel = existing.get(f.agentName).model; continue; }
        try {
          const agent = await P.createAgent({
            name: f.agentName, title: f.name.slice(0, 42),
            systemPrompt: `You are the operations agent of ${f.name}, a ${f.business} company in the Corner Office tower. You do the company's daily work - research, building, and reports - and bring finished jobs to the owner when a human decision is needed. Be concrete and brief.`,
            description: `Corner Office tower floor agent for ${f.name}`,
          });
          f.agentModel = agent.model || null;
          logLine(`Agent <code>${esc(f.agentName)}</code> created on your account`);
        } catch (e) { logLine(`Agent ${esc(f.agentName)} failed: ${esc(e.message)}`); }
      }
    } else {
      logLine('<b>Connected</b> without keys permission - agent-less mode (plain model calls on your Pollen, nothing created on your account).');
    }
    save();
    $('btn-connect').textContent = owner ? `Connected: ${owner}` : 'Connected';
    $('btn-connect').disabled = false;
    $('btn-run-day').disabled = false;
    $('run-day-note').textContent = canAgents
      ? 'Runs your floor agents - paid from your Pollen, capped by the budget you set.'
      : 'Agent-less mode: plain model calls on your Pollen. Reconnect with keys ticked for real floor agents.';
    renderDirectory(); renderReceipts(); renderDecisions();
  }

  // ---------- replay ----------
  $('btn-demo').addEventListener('click', () => {
    if (running || paidBusy) return;
    if (mode === 'live' && !confirm('Switch to replay mode? Your connected tower stays saved.')) return;
    mode = 'replay';
    if (!replay.floors.length) seedFloors(replay);
    rebuildTower(); renderDirectory(); renderReceipts(); renderDecisions();
    $('btn-run-day').disabled = false;
    $('run-day-note').textContent = 'Replay mode: scripted sample workday - nothing is spent.';
    logLine('<b>Replay mode</b> - sample data, no Pollen spent.');
    location.hash = '#/tower';
  });

  $('btn-run-day').addEventListener('click', runWorkday);
  $('btn-back-tower').addEventListener('click', () => { location.hash = '#/tower'; });

  // ---------- rent ----------
  $('rent-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (running || paidBusy) return;
    if (!mode) { $('rent-result').textContent = 'Choose replay mode or connect first.'; return; }
    const name = $('rent-name').value.trim(), biz = $('rent-biz').value.trim();
    if (!name || !biz) return;
    const f = {
      id: 'f' + Date.now(), name, tagline: biz, business: biz,
      agentName: `${P.AGENT_PREFIX}-${slug(name)}`, active: false, jobs: [],
    };
    S().floors.push(f);
    if (mode === 'live' && canAgents) {
      try {
        const agent = await P.createAgent({
          name: f.agentName, title: name.slice(0, 42),
          systemPrompt: `You are the operations agent of ${name}, a ${biz} company in the Corner Office tower. You do the company's daily work and bring decisions to the owner. Be concrete and brief.`,
          description: `Corner Office tower floor agent for ${name}`,
        });
        f.agentModel = agent.model || null;
        $('rent-result').textContent = `Approved - floor ${S().floors.length} is yours, and agent ${f.agentName} now lives on your account (it runs on your Pollen).`;
      } catch (err) {
        $('rent-result').textContent = `Floor added, but agent creation failed: ${err.message}`;
      }
      save();
    } else {
      $('rent-result').textContent = mode === 'replay'
        ? `Floor ${S().floors.length} added to the sample tower (replay - nothing created).`
        : 'Floor added. It will run agent-less until you connect with the keys permission.';
    }
    $('rent-name').value = ''; $('rent-biz').value = '';
    rebuildTower(); renderDirectory();
  });

  // ---------- receipts export ----------
  $('btn-export-receipts').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(S().receipts, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `corner-office-receipts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---------- helpers ----------
  function esc(s) { const d = document.createElement('div'); d.textContent = String(s ?? ''); return d.innerHTML; }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ---------- boot ----------
  window.addEventListener('hashchange', route);
  seedFloors(state); // default tower for first paint (not saved until live work happens)
  T.bind();
  rebuildTower();
  route();
  // restore a live session if the tab still holds the key
  if (P.store.key) { finishConnect().catch(e => { logLine(esc(e.message)); $('btn-run-day').disabled = true; }); }
})();
