const $ = id => document.getElementById(id);
const state = { connected: false, accounts: [], source: null, current: null, config: null };

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  let data;
  try { data = await response.json(); } catch { throw new Error('The server returned an invalid response.'); }
  if (!response.ok) throw new Error(data.error?.message || 'Request failed.');
  return data;
}
function visible(id, show) { $(id).hidden = !show; }
function notify(message) { $('flash').textContent = message; visible('flash', !!message); }
function renderStatus(text) { $('instance-details').textContent = text; }
function fillText(element, value) { $(element).textContent = value; }
function create(tag, text, cls) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}

async function loadSource() {
  try {
    const commit = await api('/api/v1/source/main');
    state.source = commit;
    fillText('source-sha', commit.shortSha);
    fillText('source-message', commit.message || 'Latest main commit');
    $('source-link').href = commit.url;
    $('source-link').rel = 'noopener noreferrer';
  } catch (error) {
    fillText('source-sha', 'Unavailable');
    fillText('source-message', error.message);
  }
}
async function loadConfig() {
  try { state.config = await api('/api/v1/config'); }
  catch { state.config = null; }
}
async function loadSession() {
  let session;
  try { session = await api('/api/v1/session'); }
  catch { session = { connected: false, oauthConfigured: false }; }
  state.connected = session.connected;
  fillText('connection-badge', session.connected ? 'Connected' : 'Not connected');
  $('connection-badge').classList.toggle('connected', session.connected);
  const button = $('connect-button');
  button.textContent = session.connected ? 'Manage connection ✓' : 'Connect Cloudflare ↗';
  if (session.connected) {
    button.href = '#account';
  } else if (!session.oauthConfigured) {
    button.removeAttribute('href');
    button.title = 'Cloudflare OAuth credentials have not been configured.';
    button.classList.add('muted-button');
    button.classList.remove('primary-button');
  }
  fillText('connection-note', !session.oauthConfigured ?
    'Cloudflare OAuth is not yet configured. Source inspection is available.' :
    'Deployment execution remains disabled until user-owned source builds have been verified.');
  visible('account-offline', !session.connected);
  visible('account-online', session.connected);
  if (session.connected) await loadAccounts();
}

async function loadAccounts() {
  try {
    const result = await api('/api/v1/providers/cloudflare/accounts');
    state.accounts = result.accounts || [];
    const select = $('account-select');
    select.replaceChildren(create('option', 'Choose Cloudflare account…'));
    for (const account of state.accounts) {
      const opt = create('option', account.name || account.id);
      opt.value = account.id;
      select.append(opt);
    }
    renderStatus(state.accounts.length ? 'Choose an account to discover your InsightFlare instance.' : 'No accessible Cloudflare accounts were found.');
  } catch (error) { notify(error.message); }
}

async function onAccountChanged() {
  const accountId = $('account-select').value;
  state.current = null;
  $('preview-plan').disabled = !accountId;
  visible('plan-output', true);
  $('plan-output').replaceChildren(create('p', 'Select Preview plan to inspect the intended changes.'));
  if (!accountId) return renderStatus('Choose an account to inspect its installation.');
  renderStatus('Inspecting Cloudflare account…');
  try {
    const { deployment } = await api(`/api/v1/providers/cloudflare/accounts/${accountId}/deployment`);
    state.current = deployment;
    const status = {
      'not-installed': 'No standard InsightFlare Worker found.',
      'managed': 'Managed InsightFlare deployment detected.',
      'legacy-candidate': 'Existing InsightFlare worker detected (manual adoption required).',
      'conflict': 'An unknown or incompatible Worker occupies the standard name.'
    };
    $('instance-details').replaceChildren(
      create('strong', status[deployment.kind] || deployment.kind),
      create('div', `Worker: ${deployment.workerName} · Commit: ${deployment.deployedSha?.slice(0, 8) || 'Unknown'}`),
      ...deployment.issues.map(issue => create('div', issue))
    );
    $('intent-select').value = deployment.kind === 'not-installed' ? 'install' : 'update';
  } catch (error) { renderStatus(error.message); notify(error.message); }
}
async function previewPlan() {
  const accountId = $('account-select').value;
  if (!accountId) return;
  $('preview-plan').disabled = true;
  $('plan-output').replaceChildren(create('p', 'Generating a read-only deployment plan…'));
  try {
    const intent = $('intent-select').value;
    const { plan } = await api(`/api/v1/providers/cloudflare/accounts/${accountId}/plan?intent=${encodeURIComponent(intent)}`);
    const view = create('div', undefined, 'plan-content');
    view.append(create('div', `Operation: ${plan.intent} · Target SHA: ${plan.sourceSha.slice(0, 12)}`));
    const heading = create('h3', 'Safety gates');
    view.append(heading);
    for (const issue of plan.blockers) view.append(create('div', issue, 'blocker'));
    view.append(create('h3', 'Proposed steps'));
    const steps = create('ul');
    for (const step of plan.proposedSteps) steps.append(create('li', step));
    view.append(steps);
    $('plan-output').replaceWith(view);
    view.id = 'plan-output';
  } catch (error) {
    const p = create('div', error.message, 'plan-placeholder');
    $('plan-output').replaceWith(p);
    p.id = 'plan-output';
    notify(error.message);
  } finally { $('preview-plan').disabled = false; }
}

async function disconnect() {
  try {
    await api('/api/v1/session/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: location.origin } });
    location.replace('/');
  } catch (error) { notify(error.message); }
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const reason = params.get('error');
  if (reason) notify('Cloudflare authorization could not be completed (' + reason + ').');
  $('account-select').addEventListener('change', () => void onAccountChanged());
  $('preview-plan').addEventListener('click', () => void previewPlan());
  $('disconnect-button').addEventListener('click', () => void disconnect());
  await Promise.all([loadConfig(), loadSource(), loadSession()]);
});
