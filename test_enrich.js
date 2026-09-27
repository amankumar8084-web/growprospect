import https from 'node:https';

async function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
         return resolve(fetchHtml(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  const query = `Finley's Barbershop Austin TX`;
  const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&extratags=1`;
  
  try {
    const jsonStr = await fetchHtml(searchUrl);
    const data = JSON.parse(jsonStr);
    console.log("Nominatim Data:", data);
  } catch(e) {
    console.error(e);
  }
}
run();
