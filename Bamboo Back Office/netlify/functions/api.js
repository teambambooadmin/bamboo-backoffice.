// Netlify Function — proxies API calls to the Apps Script deployment.
// The browser calls THIS function (same-origin, no CORS issue).
// This function then calls Apps Script server-to-server, where CORS
// doesn't apply (CORS is a browser-only restriction), and passes the
// JSON response straight back.

exports.handler = async function (event) {
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwPI0LNUuoQe6Vh3nZDOhgh3vaGrSnRFe16k7lnhO76GeFbv9MsuJ2UEEm_jDRC7g/exec';

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: event.body,
      redirect: 'follow' // Apps Script often 302s before returning the real response
    });

    const text = await res.text();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Proxy error: ' + err.message })
    };
  }
};
