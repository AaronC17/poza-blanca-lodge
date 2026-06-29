const http = require('http');

function get(path, cookies) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path, method: 'GET', headers: { Cookie: cookies || '' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

function post(path, body, cookies) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies || '' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  // 1. Get login page
  const loginPage = await get('/login', '');
  const csrfMatch = loginPage.body.match(/name="_csrf"\s+value="([^"]+)"/);
  const csrf = csrfMatch ? csrfMatch[1] : '';
  const setCookies = loginPage.headers['set-cookie'] || [];
  const cookies = setCookies.map(c => c.split(';')[0]).join('; ');
  console.log('Login page:', loginPage.status, 'csrf:', csrf ? 'found' : 'NOT FOUND');

  // 2. Post login
  const loginRes = await post('/login', `_csrf=${csrf}&username=admin&password=pozablanca2026`, cookies);
  const loginCookies = loginRes.headers['set-cookie'] || [];
  const allCookies = loginCookies.map(c => c.split(';')[0]).join('; ');
  console.log('Login POST:', loginRes.status, 'Location:', loginRes.headers.location);

  // 3. Follow redirect to dashboard
  if (loginRes.headers.location) {
    const dashRes = await get(loginRes.headers.location, allCookies);
    console.log('Dashboard:', dashRes.status, 'length:', dashRes.body.length);
    if (dashRes.status !== 200) {
      console.log('Error body:', dashRes.body.substring(0, 800));
    }
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
