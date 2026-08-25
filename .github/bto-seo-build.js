const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(process.cwd(), 'public');
const baseUrl = 'https://builttooffend.com';
const today = '2026-08-25';

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function stripSeoTags(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/ig, '')
    .replace(/<meta\s+name=["']robots["'][^>]*>/ig, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/ig, '')
    .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/ig, '')
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/ig, '')
    .replace(/<script\s+type=["']application\/ld\+json["'][^>]*data-bto-seo[^>]*>[\s\S]*?<\/script>/ig, '');
}

function seoHead({title, description, canonical, type='website'}) {
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Built To Offend',
      url: `${baseUrl}/`,
      inLanguage: 'en-GB'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Built To Offend',
      url: `${baseUrl}/`
    }
  ];
  return `
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="${esc(type)}">
  <meta property="og:site_name" content="Built To Offend">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <script type="application/ld+json" data-bto-seo>${JSON.stringify(schema)}</script>`;
}

function injectHead(html, meta) {
  html = stripSeoTags(html);
  if (!/<head[^>]*>/i.test(html)) throw new Error('No <head> found');
  return html.replace(/<\/head>/i, `${seoHead(meta)}\n</head>`);
}

const categories = [
  {
    slug: 'funny-birthday-cards.html',
    title: 'Funny Birthday Cards | Personalised AI Cards | Built To Offend',
    h1: 'Funny Birthday Cards Made Personal',
    description: 'Create a funny personalised birthday card with AI. Turn their habits, in-jokes and personality into a one-off card, then send it straight to their door.',
    lead: 'A generic birthday card is easy to forget. Built To Offend makes a card around the person you are actually buying for — their habits, their in-jokes, the things they always say and the stories everyone remembers.',
    body: 'Choose how savage you want the joke to be, add the details that make them recognisable and let the card maker build a unique front and inside message. You can keep it light and silly or go for a much sharper roast. Every card is personalised for that order rather than picked from a fixed shelf of designs.\n\nThe result is ideal for friends, partners, workmates and family members who would rather laugh than receive another predictable birthday card. Once you are happy with the design, checkout is online and the finished personalised card is sent for printing and delivery.\n\nLooking for something even more specific? Try our rude birthday cards, personalised greeting cards, novelty cards or roast cards.'
  },
  {
    slug: 'rude-birthday-cards.html',
    title: 'Rude Birthday Cards | Personalised Adult Humour | Built To Offend',
    h1: 'Rude Birthday Cards They Will Actually Remember',
    description: 'Design a personalised rude birthday card with adult humour, in-jokes and AI-generated roasts. Create it online and have the finished card delivered.',
    lead: 'For the person who would be disappointed by a polite card, Built To Offend creates rude birthday cards around real details about the recipient.',
    body: 'Tell the card maker what they are like, what they are known for and which jokes are fair game. Pick the level of brutality and generate a card that feels written for them rather than copied from a mass-produced joke.\n\nThe aim is cheeky, sweary and funny adult humour — not threats or genuine harassment. You stay in control of the final wording before ordering. That makes it easy to create anything from a mildly inappropriate birthday card to a properly savage roast for someone who will appreciate it.\n\nYou can also explore funny birthday cards, novelty greeting cards, personalised cards and dedicated roast cards.'
  },
  {
    slug: 'personalised-cards.html',
    title: 'Personalised Greeting Cards | AI Card Maker | Built To Offend',
    h1: 'Personalised Greeting Cards Built Around Them',
    description: 'Make a one-off personalised greeting card using AI, names, stories, in-jokes and optional photos. Design online, pay securely and send it to their door.',
    lead: 'Built To Offend turns your details about a person into a greeting card that could not realistically belong to anyone else.',
    body: 'Add their name, personality, habits, embarrassing stories or private jokes and use the AI card maker to create the wording and visual direction. If you want an even more recognisable result, a photo option can be used on supported designs.\n\nThe service is designed for people who want more than a name printed onto a standard template. The humour, wording and concept are generated from the details you provide, then you review the result before checkout.\n\nPersonalised cards work particularly well for birthdays, mates, partners, colleagues and family members with a good sense of humour. For more specific ideas, browse funny birthday cards, rude birthday cards, novelty cards and roast cards.'
  },
  {
    slug: 'novelty-cards.html',
    title: 'Novelty Greeting Cards | Funny Personalised Cards | Built To Offend',
    h1: 'Novelty Greeting Cards That Are Actually Personal',
    description: 'Create original novelty greeting cards with personalised jokes, AI-generated artwork and adult humour. Make a unique card online and send it direct.',
    lead: 'Novelty cards are better when the joke is about the person receiving them. Built To Offend combines personalised details with AI to make a one-off greeting card rather than another recycled punchline.',
    body: 'Use names, habits, hobbies, embarrassing moments, work stories or the kind of joke only your group would understand. The card maker turns those details into a custom concept and inside message, with different humour levels available depending on how far you want to take it.\n\nThe site is built for funny, rude, sarcastic, sweary and roast-style cards, while keeping the final design in your hands before you order. Once approved and paid for, the personalised artwork goes into print fulfilment for delivery.\n\nIf you are shopping for a particular occasion or style, see our funny birthday cards, rude birthday cards, personalised greeting cards and roast cards.'
  },
  {
    slug: 'roast-cards.html',
    title: 'Roast Cards | Personalised Funny & Savage Cards | Built To Offend',
    h1: 'Personalised Roast Cards',
    description: 'Turn your best in-jokes into a personalised roast card. Choose the brutality, generate a unique funny card with AI and send the finished card direct.',
    lead: 'A good roast works because it is specific. Built To Offend uses the details you give it to make a card aimed at one particular person.',
    body: 'Feed the card maker the material: their questionable habits, legendary mistakes, favourite sayings, hobbies, age, job or anything else that makes the joke land. Then choose the tone and generate the card.\n\nYou can keep the roast affectionate or make it much more savage for a recipient who enjoys that kind of humour. The final result is reviewed by you before payment, so the joke stays appropriate for your relationship with them.\n\nFor other styles, browse rude birthday cards, funny birthday cards, novelty greeting cards and personalised cards.'
  }
];

const indexPath = path.join(publicDir, 'index.html');
let home = fs.readFileSync(indexPath, 'utf8');
home = injectHead(home, {
  title: 'Funny Personalised & Rude Greeting Cards | Built To Offend',
  description: 'Create personalised funny, rude and novelty greeting cards with AI. Make a one-off roast card in minutes, pay securely online and send it straight to their door.',
  canonical: `${baseUrl}/`
});

const homeSeo = `
<section id="discover-built-to-offend" aria-labelledby="discover-title" style="max-width:1100px;margin:42px auto 24px;padding:24px 20px;font-family:inherit;line-height:1.6">
  <h2 id="discover-title">Personalised funny, rude and novelty greeting cards</h2>
  <p>Built To Offend is an AI-powered card maker for people who want something more personal than a standard greeting card. Turn names, habits, in-jokes and embarrassing stories into a unique funny card, rude birthday card, novelty card or personalised roast.</p>
  <p>You control the tone and approve the design before checkout. Once ordered, the personalised card is prepared for professional printing and delivery.</p>
  <nav aria-label="Card ideas"><a href="/funny-birthday-cards.html">Funny birthday cards</a> · <a href="/rude-birthday-cards.html">Rude birthday cards</a> · <a href="/personalised-cards.html">Personalised cards</a> · <a href="/novelty-cards.html">Novelty cards</a> · <a href="/roast-cards.html">Roast cards</a></nav>
</section>`;

if (!home.includes('id="discover-built-to-offend"')) {
  home = home.replace(/<\/body>/i, `${homeSeo}\n</body>`);
}
fs.writeFileSync(indexPath, home);

const nav = categories.map(c => `<a href="/${c.slug}">${esc(c.h1.replace(/ Made Personal| They Will Actually Remember| Built Around Them| That Are Actually Personal/, ''))}</a>`).join(' · ');
const pageCss = `body{margin:0;background:#090909;color:#f7f7f7;font-family:Arial,Helvetica,sans-serif;line-height:1.65}main{max-width:850px;margin:auto;padding:44px 20px 70px}a{color:#ffd76a}h1{font-size:clamp(2rem,6vw,3.6rem);line-height:1.05;margin:.2em 0}.brand{font-weight:900;letter-spacing:.05em;text-transform:uppercase}.lead{font-size:1.2rem}.cta{display:inline-block;margin:20px 0;padding:13px 18px;border:2px solid #ffd76a;border-radius:10px;text-decoration:none;font-weight:800}.nav{margin-top:34px;padding-top:22px;border-top:1px solid #333}`;

for (const c of categories) {
  const canonical = `${baseUrl}/${c.slug}`;
  const paras = c.body.split('\n\n').map(p => `<p>${esc(p)}</p>`).join('\n');
  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${seoHead({title:c.title,description:c.description,canonical})}<style>${pageCss}</style></head>
<body><main><div class="brand"><a href="/">Built To Offend</a></div><h1>${esc(c.h1)}</h1><p class="lead">${esc(c.lead)}</p>${paras}<a class="cta" href="/">Create your personalised card</a><div class="nav" aria-label="More card ideas">${nav}</div></main></body></html>`;
  fs.writeFileSync(path.join(publicDir, c.slug), html);
}

const successPath = path.join(publicDir, 'order-success.html');
if (fs.existsSync(successPath)) {
  let success = fs.readFileSync(successPath, 'utf8');
  success = success.replace(/<meta\s+name=["']robots["'][^>]*>/ig, '');
  success = success.replace(/<\/head>/i, '<meta name="robots" content="noindex,nofollow,noarchive">\n</head>');
  fs.writeFileSync(successPath, success);
}

fs.writeFileSync(path.join(publicDir, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /order-success.html\nSitemap: ${baseUrl}/sitemap.xml\n`);

const urls = ['/', ...categories.map(c => `/${c.slug}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${baseUrl}${u}</loc><lastmod>${today}</lastmod><changefreq>${u==='/'?'weekly':'monthly'}</changefreq><priority>${u==='/'?'1.0':'0.8'}</priority></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap);

console.log(`SEO ready: homepage + ${categories.length} search landing pages + robots.txt + sitemap.xml`);
