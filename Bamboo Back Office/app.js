// =========================================================
// CONFIG — calls our own Netlify Function, which proxies to
// Apps Script server-to-server (avoids the browser CORS block
// we hit calling Apps Script directly).
// =========================================================
const API_URL = '/.netlify/functions/api';

// =========================================================
// API CLIENT
// Calls the Apps Script API. This is the thing we're actually
// testing today: can a page hosted on a real domain read the
// response, or does it hit the CORS wall we saw with file://?
// =========================================================
async function apiCall(fn, args, session) {
  const body = { fn: fn, args: args || [] };
  if (session) body.session = session;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error('Non-JSON response (likely blocked or redirected): ' + text.slice(0, 200));
  }

  if (!json.ok) throw new Error(json.error || 'Unknown API error');
  return json.data;
}

// =========================================================
// SESSION (kept in localStorage so a refresh doesn't log you out —
// this is a real hosted site, not a Claude artifact, so
// localStorage is appropriate here)
// =========================================================
function saveSession(session) {
  localStorage.setItem('bamboo_session', JSON.stringify(session));
}
function getSavedSession() {
  const raw = localStorage.getItem('bamboo_session');
  return raw ? JSON.parse(raw) : null;
}
function clearSession() {
  localStorage.removeItem('bamboo_session');
}

// =========================================================
// LOGIN
// =========================================================
async function handleLogin() {
  const name = document.getElementById('login-name').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    // verifyLogin takes plain args (name, password), not a session object
    const result = await apiCall('verifyLogin', [name, password]);
    if (!result.success) {
      errorEl.textContent = result.error || 'Sign in failed.';
      return;
    }
    saveSession({ name: name, password: password });
    showApp();
  } catch (e) {
    errorEl.textContent = 'Could not reach the server: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

function handleSignOut() {
  const session = getSavedSession();
  if (session) {
    apiCall('logSignOut', [session.name]).catch(function () {}); // fire-and-forget
  }
  clearSession();
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

// =========================================================
// APP SHELL
// =========================================================
function showApp() {
  const session = getSavedSession();
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('user-name-label').textContent = session.name;
  loadHome();
}

async function loadHome() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading">Loading your dashboard...</div>';

  try {
    const session = getSavedSession();
    const data = await apiCall('getHomeData', [], session);
    renderHome(data);
  } catch (e) {
    content.innerHTML = '<div class="error-box">Could not load dashboard: ' + e.message + '</div>';
  }
}

function renderHome(data) {
  const content = document.getElementById('content');
  const kpi = data.kpi || {};

  let html = '';
  html += '<div class="kpi-row">';
  html += kpiCard('YTD Premium', fmtMoney(kpi.ytd));
  html += kpiCard('YTD Policies', kpi.ytdPolicyCount || 0);
  html += kpiCard('Active Policies', kpi.activePolicies || 0);
  html += kpiCard('Active Premium', fmtMoney(kpi.activePremium));
  html += '</div>';

  html += '<div class="section-title">Monthly Trend</div>';
  if (data.trend && data.trend.length) {
    html += '<div class="kpi-row">';
    data.trend.forEach(function (m) {
      html += kpiCard(m.monthShort, fmtMoney(m.premium));
    });
    html += '</div>';
  }

  content.innerHTML = html;
}

function kpiCard(label, value) {
  return '<div class="kpi-card"><div class="kpi-label">' + label + '</div><div class="kpi-value">' + value + '</div></div>';
}

function fmtMoney(n) {
  if (n === undefined || n === null) return '$0';
  return '$' + Math.round(n).toLocaleString('en-US');
}

// =========================================================
// INIT — resume session if we already have one
// =========================================================
(function init() {
  const session = getSavedSession();
  if (session) {
    showApp();
  }
})();
