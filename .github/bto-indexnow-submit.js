const fs = require('fs');

const key = '764dedfb795c8f6a39c64651a625e480';
const site = 'https://builttooffend.com';

async function main(){
  const sitemapUrl = `${site}/sitemap.xml?indexnow=${Date.now()}`;
  const response = await fetch(sitemapUrl, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`Could not fetch live sitemap: HTTP ${response.status}`);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
  if (!urls.length) throw new Error('Live sitemap contains no URLs');

  const payload = {
    host: 'builttooffend.com',
    key,
    keyLocation: `${site}/${key}.txt`,
    urlList: urls.slice(0, 10000)
  };

  const submit = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  });

  const body = await submit.text();
  console.log(`IndexNow HTTP ${submit.status}${body ? `: ${body}` : ''}`);
  if (![200, 202].includes(submit.status)) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
