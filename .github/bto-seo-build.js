const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(process.cwd(), 'public');
const baseUrl = 'https://builttooffend.com';
const today = new Date().toISOString().slice(0, 10);

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

function seoHead({title, description, canonical, h1 = title, type='website'}) {
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
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: h1,
      url: canonical,
      description,
      inLanguage: 'en-GB',
      isPartOf: { '@type': 'WebSite', name: 'Built To Offend', url: `${baseUrl}/` }
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
  ['funny-birthday-cards.html','Funny Birthday Cards | Personalised AI Cards | Built To Offend','Funny Birthday Cards Made Personal','Create a funny personalised birthday card with AI. Turn their habits, in-jokes and personality into a one-off card, then send it straight to their door.','A generic birthday card is easy to forget. Built To Offend makes a card around the person you are actually buying for — their habits, their in-jokes, the things they always say and the stories everyone remembers.','Choose how savage you want the joke to be, add the details that make them recognisable and let the card maker build a unique front and inside message. You can keep it light and silly or go for a much sharper roast. Every card is personalised for that order rather than picked from a fixed shelf of designs.\n\nThe result is ideal for friends, partners, workmates and family members who would rather laugh than receive another predictable birthday card. Once you are happy with the design, checkout is online and the finished personalised card is sent for printing and delivery.\n\nLooking for something even more specific? Try our rude birthday cards, personalised greeting cards, novelty cards or roast cards.'],
  ['rude-birthday-cards.html','Rude Birthday Cards | Personalised Adult Humour | Built To Offend','Rude Birthday Cards They Will Actually Remember','Design a personalised rude birthday card with adult humour, in-jokes and AI-generated roasts. Create it online and have the finished card delivered.','For the person who would be disappointed by a polite card, Built To Offend creates rude birthday cards around real details about the recipient.','Tell the card maker what they are like, what they are known for and which jokes are fair game. Pick the level of brutality and generate a card that feels written for them rather than copied from a mass-produced joke.\n\nThe aim is cheeky, sweary and funny adult humour — not threats or genuine harassment. You stay in control of the final wording before ordering. That makes it easy to create anything from a mildly inappropriate birthday card to a properly savage roast for someone who will appreciate it.\n\nYou can also explore funny birthday cards, novelty greeting cards, personalised cards and dedicated roast cards.'],
  ['offensive-birthday-cards.html','Offensive Birthday Cards | Personalised Savage Humour | Built To Offend','Offensive Birthday Cards With a Personal Punch','Create an offensive birthday card built around real in-jokes, habits and embarrassing stories. Choose the brutality, edit the wording and order online.','When a normal birthday card is far too tame, this is the place to build something sharper, more personal and much harder to forget.','Built To Offend uses the details you supply to generate humour aimed at the actual recipient, rather than recycling a generic insult. The result can be crude, savage and deliberately inappropriate while still being something you review before ordering.\n\nUse their age, catchphrases, work habits, hobbies, legendary mistakes or the sort of story that always gets repeated at the pub. Adjust the brutality until the joke fits your relationship, then edit anything you want before checkout.\n\nIf you want similar styles, see rude birthday cards, roast cards and funny personalised cards.'],
  ['personalised-cards.html','Personalised Greeting Cards | AI Card Maker | Built To Offend','Personalised Greeting Cards Built Around Them','Make a one-off personalised greeting card using AI, names, stories, in-jokes and optional photos. Design online, pay securely and send it to their door.','Built To Offend turns your details about a person into a greeting card that could not realistically belong to anyone else.','Add their name, personality, habits, embarrassing stories or private jokes and use the AI card maker to create the wording and visual direction. If you want an even more recognisable result, a photo option can be used on supported designs.\n\nThe service is designed for people who want more than a name printed onto a standard template. The humour, wording and concept are generated from the details you provide, then you review the result before checkout.\n\nPersonalised cards work particularly well for birthdays, mates, partners, colleagues and family members with a good sense of humour.'],
  ['novelty-cards.html','Novelty Greeting Cards | Funny Personalised Cards | Built To Offend','Novelty Greeting Cards That Are Actually Personal','Create original novelty greeting cards with personalised jokes, AI-generated artwork and adult humour. Make a unique card online and send it direct.','Novelty cards are better when the joke is about the person receiving them. Built To Offend combines personalised details with AI to make a one-off greeting card rather than another recycled punchline.','Use names, habits, hobbies, embarrassing moments, work stories or the kind of joke only your group would understand. The card maker turns those details into a custom concept and inside message, with different humour levels available depending on how far you want to take it.\n\nThe site is built for funny, rude, sarcastic, sweary and roast-style cards, while keeping the final design in your hands before you order. Once approved and paid for, the personalised artwork goes into print fulfilment for delivery.'],
  ['roast-cards.html','Roast Cards | Personalised Funny & Savage Cards | Built To Offend','Personalised Roast Cards','Turn your best in-jokes into a personalised roast card. Choose the brutality, generate a unique funny card with AI and send the finished card direct.','A good roast works because it is specific. Built To Offend uses the details you give it to make a card aimed at one particular person.','Feed the card maker the material: their questionable habits, legendary mistakes, favourite sayings, hobbies, age, job or anything else that makes the joke land. Then choose the tone and generate the card.\n\nYou can keep the roast affectionate or make it much more savage for a recipient who enjoys that kind of humour. The final result is reviewed by you before payment, so the joke stays appropriate for your relationship with them.'],
  ['funny-cards-for-him.html','Funny Cards For Him | Personalised Birthday Cards | Built To Offend','Funny Personalised Cards For Him','Create funny personalised cards for him using names, in-jokes, habits and savage humour. Build a one-off card online and send it direct.','For husbands, boyfriends, dads, brothers or mates, a card lands better when it sounds like it was written by someone who actually knows him.','Add the details that make him recognisable: the hobby he never shuts up about, the phrase he says every five minutes, the ridiculous purchase, the terrible timekeeping or the story everybody still brings up.\n\nBuilt To Offend turns that material into personalised card wording rather than just printing his name on a stock design. You can keep it cheeky or push the humour much harder before you approve the final result.'],
  ['funny-cards-for-her.html','Funny Cards For Her | Personalised Birthday Cards | Built To Offend','Funny Personalised Cards For Her','Make funny personalised cards for her with in-jokes, stories, names and AI-generated humour. Create a unique birthday or occasion card online.','A funny card for her should sound like it came from you, not from a supermarket shelf.','Use the details only your relationship would know: the obsession, the catchphrase, the shopping habit, the holiday disaster, the work story or the thing she is always late for. The generator uses those details to make a card with a recognisable voice and a proper personal punchline.\n\nYou approve the wording and design before checkout, so the joke can stay affectionate, rude or savage depending on who is receiving it.'],
  ['funny-cards-for-mates.html','Funny Cards For Mates | Personalised Roast Cards | Built To Offend','Funny Cards For Mates Who Can Take a Joke','Create personalised funny cards for mates using in-jokes, embarrassing stories and savage AI-generated roasts.','Cards between mates should be specific enough that nobody else could receive the same one.','Give us the material your group already laughs about: terrible dating choices, football delusions, bad driving, legendary nights out, work disasters or the nickname that refuses to die. Built To Offend turns that into a personalised front and inside message.\n\nChoose the brutality, edit the result and order once it feels exactly right for your mate.'],
  ['birthday-cards-for-husband.html','Funny Birthday Cards For Husband | Personalised | Built To Offend','Funny Birthday Cards For Your Husband','Create a personalised funny birthday card for your husband with private jokes, habits, stories and AI-generated humour.','Skip the generic husband card and make one that actually sounds like your relationship.','Add the habits you lovingly tolerate, the thing he is convinced he is brilliant at, the purchase he still defends, the hobby that has taken over the house or the line he says constantly.\n\nBuilt To Offend turns those details into a personalised birthday card you can keep playful, rude or properly savage. Review everything before checkout and send the finished card for printing and delivery.'],
  ['birthday-cards-for-wife.html','Funny Birthday Cards For Wife | Personalised | Built To Offend','Funny Birthday Cards For Your Wife','Make a funny personalised birthday card for your wife using your own in-jokes, stories and AI-generated humour.','A wife birthday card does not have to be sentimental and predictable. It can be personal, funny and unmistakably yours.','Add the stories, habits, catchphrases and harmless ammunition that make the relationship recognisable. The generator turns them into a one-off card rather than a generic template.\n\nYou control the tone before ordering, so it can stay affectionate or become a full roast if that is the kind of humour you share.'],
  ['birthday-cards-for-boyfriend.html','Funny Birthday Cards For Boyfriend | Personalised | Built To Offend','Funny Birthday Cards For Your Boyfriend','Create a funny personalised birthday card for your boyfriend using private jokes, habits and AI-generated roast humour.','If he would laugh harder at being roasted than being called “the best boyfriend ever”, build the card around him instead.','Use the things you tease him about already: gaming, gym obsession, terrible fashion, selective hearing, lateness or whatever makes the joke instantly recognisable.\n\nBuilt To Offend generates the front and inside copy from those details, then lets you choose how savage to make it before checkout.'],
  ['birthday-cards-for-girlfriend.html','Funny Birthday Cards For Girlfriend | Personalised | Built To Offend','Funny Birthday Cards For Your Girlfriend','Create a funny personalised birthday card for your girlfriend using in-jokes, stories and AI-generated humour.','Make the birthday card about the person you actually know instead of settling for a generic romantic message.','Add the harmless things you always joke about together: the catchphrase, reality-TV obsession, coffee order, holiday story, shopping habit or anything else that makes the card immediately hers.\n\nChoose the humour level, edit the wording if needed and order the finished personalised card online.'],
  ['funny-anniversary-cards.html','Funny Anniversary Cards | Personalised Couple Humour | Built To Offend','Funny Personalised Anniversary Cards','Create a funny personalised anniversary card using relationship in-jokes, habits and stories. Build it online with AI and send the finished card direct.','Anniversary cards do not have to pretend the relationship has been dignified from start to finish.','Use the stories that actually define the two of you: terrible first dates, household arguments, travel disasters, weird routines, pet obsessions or the thing one of you always does. Built To Offend turns those details into personalised anniversary humour.\n\nKeep it sweet with a sharp edge or make it properly rude. You review everything before payment.'],
  ['funny-retirement-cards.html','Funny Retirement Cards | Personalised Work Roasts | Built To Offend','Funny Personalised Retirement Cards','Create a personalised funny retirement card using workplace in-jokes, habits, stories and AI-generated roasts.','Retirement cards are much better when the whole workplace recognises the joke.','Add the meetings they hated, the mug they guarded with their life, the job they always avoided, the phrase they repeated or the story everyone still tells. The card maker turns that workplace history into a personalised retirement card.\n\nYou can keep it office-safe or make it much sharper for a colleague who enjoys rude humour.'],
  ['funny-leaving-cards.html','Funny Leaving Cards | Personalised Workmate Cards | Built To Offend','Funny Personalised Leaving Cards','Create a personalised funny leaving card for a colleague, mate or workmate using in-jokes, stories and AI-generated humour.','A leaving card should remind them exactly what they are escaping from.','Use workplace habits, tea-round offences, terrible meeting behaviour, office catchphrases or any harmless story the team will recognise. Built To Offend turns the details into a unique leaving card instead of another “good luck in your new job” message.\n\nReview the final joke, choose how rude it should be and order online.']
].map(([slug,title,h1,description,lead,body]) => ({slug,title,h1,description,lead,body}));

const indexPath = path.join(publicDir, 'index.html');
let home = fs.readFileSync(indexPath, 'utf8');
home = injectHead(home, {
  title: 'Funny Personalised, Rude & Offensive Cards | Built To Offend',
  description: 'Create personalised funny, rude and offensive greeting cards with AI. Make birthday cards, roast cards and novelty cards from real in-jokes, then order online.',
  canonical: `${baseUrl}/`,
  h1: 'Built To Offend personalised greeting cards'
});

const homeSeo = `
<section id="discover-built-to-offend" aria-labelledby="discover-title" style="max-width:1100px;margin:42px auto 24px;padding:24px 20px;font-family:inherit;line-height:1.6">
  <h2 id="discover-title">Personalised funny, rude and offensive greeting cards</h2>
  <p>Built To Offend is an AI-powered card maker for people who want something more personal than a standard greeting card. Turn names, habits, in-jokes and embarrassing stories into a unique funny card, rude birthday card, novelty card or personalised roast.</p>
  <p>You control the tone and approve the design before checkout. Once ordered, the personalised card is prepared for professional printing and delivery.</p>
  <nav aria-label="Popular card ideas">${categories.slice(0,10).map(c => `<a href="/${c.slug}">${esc(c.h1)}</a>`).join(' · ')}</nav>
</section>`;

if (home.includes('id="discover-built-to-offend"')) {
  home = home.replace(/<section id="discover-built-to-offend"[\s\S]*?<\/section>/i, homeSeo.trim());
} else {
  home = home.replace(/<\/body>/i, `${homeSeo}\n</body>`);
}
fs.writeFileSync(indexPath, home);

const nav = categories.map(c => `<a href="/${c.slug}">${esc(c.h1)}</a>`).join(' · ');
const pageCss = `body{margin:0;background:#090909;color:#f7f7f7;font-family:Arial,Helvetica,sans-serif;line-height:1.65}main{max-width:900px;margin:auto;padding:44px 20px 70px}a{color:#ffd76a}h1{font-size:clamp(2rem,6vw,3.6rem);line-height:1.05;margin:.2em 0}.brand{font-weight:900;letter-spacing:.05em;text-transform:uppercase}.lead{font-size:1.2rem}.cta{display:inline-block;margin:20px 0;padding:13px 18px;border:2px solid #ffd76a;border-radius:10px;text-decoration:none;font-weight:800}.nav{margin-top:34px;padding-top:22px;border-top:1px solid #333}.faq{margin-top:28px;padding-top:20px;border-top:1px solid #333}.faq h2{font-size:1.45rem}.faq h3{font-size:1.05rem;margin-bottom:.3rem}`;

for (const c of categories) {
  const canonical = `${baseUrl}/${c.slug}`;
  const paras = c.body.split('\n\n').map(p => `<p>${esc(p)}</p>`).join('\n');
  const faq = `<section class="faq"><h2>About personalised cards</h2><h3>Can I edit the wording?</h3><p>Yes. You review the generated card before ordering and can change the wording to suit the recipient.</p><h3>How personal can I make it?</h3><p>Use names, habits, stories, hobbies, catchphrases and in-jokes you are comfortable including in the card.</p><h3>Can I choose how rude it is?</h3><p>Yes. The card maker lets you choose the humour level, from cheeky to much more savage adult humour.</p></section>`;
  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${seoHead({title:c.title,description:c.description,canonical,h1:c.h1})}<style>${pageCss}</style></head>
<body><main><div class="brand"><a href="/">Built To Offend</a></div><h1>${esc(c.h1)}</h1><p class="lead">${esc(c.lead)}</p>${paras}<a class="cta" href="/">Create your personalised card</a>${faq}<div class="nav" aria-label="More card ideas">${nav}</div></main></body></html>`;
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
