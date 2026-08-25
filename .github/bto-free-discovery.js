const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(process.cwd(), 'public');
const site = 'https://builttooffend.com';
const indexNowKey = '764dedfb795c8f6a39c64651a625e480';

function stripExtraSchema(html){
  return html.replace(/<script\s+type=["']application\/ld\+json["'][^>]*data-bto-free-discovery[^>]*>[\s\S]*?<\/script>/ig, '');
}
function text(html, re, fallback=''){
  return (html.match(re)?.[1] || fallback).replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&#39;/g,"'").trim();
}
function canonical(html, fallback){ return html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)/i)?.[1] || fallback; }

const htmlFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.html') && f !== 'order-success.html');
for(const file of htmlFiles){
  const p = path.join(publicDir, file);
  let html = stripExtraSchema(fs.readFileSync(p,'utf8'));
  const url = canonical(html, file === 'index.html' ? `${site}/` : `${site}/${file}`);
  const title = text(html, /<title>([\s\S]*?)<\/title>/i, 'Built To Offend');
  const h1 = text(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i, title);
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)/i)?.[1] || '';
  const isHome = file === 'index.html';
  const schemas = [];

  schemas.push({
    '@context':'https://schema.org','@type':'BreadcrumbList',
    itemListElement: isHome ? [{ '@type':'ListItem', position:1, name:'Built To Offend', item:`${site}/` }] : [
      { '@type':'ListItem', position:1, name:'Built To Offend', item:`${site}/` },
      { '@type':'ListItem', position:2, name:h1, item:url }
    ]
  });

  if(isHome){
    schemas.push({
      '@context':'https://schema.org','@type':'Product',
      name:'Built To Offend personalised greeting card',
      description:'A personalised funny, rude or roast-style greeting card generated from the recipient details you provide.',
      brand:{'@type':'Brand',name:'Built To Offend'},
      category:'Personalised greeting cards',
      offers:{'@type':'Offer',url:`${site}/`,priceCurrency:'GBP',price:'4.99',availability:'https://schema.org/InStock',itemCondition:'https://schema.org/NewCondition'}
    });
  } else if(html.includes('class="faq"')){
    schemas.push({
      '@context':'https://schema.org','@type':'FAQPage',
      mainEntity:[
        {'@type':'Question',name:'Can I edit the wording?',acceptedAnswer:{'@type':'Answer',text:'Yes. You review the generated card before ordering and can change the wording to suit the recipient.'}},
        {'@type':'Question',name:'How personal can I make it?',acceptedAnswer:{'@type':'Answer',text:'Use names, habits, stories, hobbies, catchphrases and in-jokes you are comfortable including in the card.'}},
        {'@type':'Question',name:'Can I choose how rude it is?',acceptedAnswer:{'@type':'Answer',text:'Yes. The card maker lets you choose the humour level, from cheeky to much more savage adult humour.'}}
      ]
    });
  }

  const block = `<script type="application/ld+json" data-bto-free-discovery>${JSON.stringify(schemas)}</script>`;
  html = html.replace(/<\/head>/i, `${block}\n</head>`);
  fs.writeFileSync(p, html);
}

fs.writeFileSync(path.join(publicDir, `${indexNowKey}.txt`), `${indexNowKey}\n`);
fs.writeFileSync(path.join(publicDir, 'llms.txt'), `# Built To Offend\n\nBuilt To Offend creates personalised funny, rude, novelty and roast-style greeting cards from user-supplied names, habits, stories and in-jokes.\n\nCanonical site: ${site}/\nSitemap: ${site}/sitemap.xml\nPrimary categories: funny birthday cards, rude birthday cards, offensive birthday cards, personalised cards, novelty cards, roast cards, anniversary cards, retirement cards and leaving cards.\nPrice: GBP 4.99 per card, with delivery charged separately.\n`);

const sitemapPath = path.join(publicDir, 'sitemap.xml');
if(fs.existsSync(sitemapPath)){
  const xml = fs.readFileSync(sitemapPath,'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const updated = new Date().toUTCString();
  const items = urls.slice(0,50).map((url,i)=>`<item><title>${i===0?'Built To Offend':'Built To Offend card guide'}</title><link>${url}</link><guid>${url}</guid><pubDate>${updated}</pubDate><description>Personalised funny and rude greeting card ideas from Built To Offend.</description></item>`).join('');
  fs.writeFileSync(path.join(publicDir,'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Built To Offend</title><link>${site}/</link><description>Personalised funny, rude and roast-style greeting cards.</description>${items}</channel></rss>`);
}

console.log(`Free discovery ready: ${htmlFiles.length} HTML pages + Product/FAQ/Breadcrumb schema + IndexNow key + feed + llms.txt`);
