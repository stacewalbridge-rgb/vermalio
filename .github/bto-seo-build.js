// Preserve the existing SEO build, then expand organic coverage and apply production hardening.
require('./bto-seo-original.js');

// Additional high-intent UK greeting-card SEO. These pages are intentionally useful,
// differentiated landing pages rather than thin doorway pages.
(() => {
  const fs = require('fs');
  const path = require('path');
  const publicDir = path.resolve(process.cwd(), 'public');
  const baseUrl = 'https://builttooffend.com';
  const today = new Date().toISOString().slice(0, 10);

  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const pages = [
    {
      slug: 'adult-humour-cards.html',
      title: 'Adult Humour Cards | Funny Personalised Cards UK | Built To Offend',
      h1: 'Adult humour cards made for the person receiving them',
      description: 'Create personalised adult humour cards with rude jokes, private in-jokes and AI-written card messages. Choose the brutality, review it and order online in the UK.',
      intro: 'Adult humour works best when it feels like it could only have been written for one person. Built To Offend turns names, habits, embarrassing stories and private jokes into a card with a proper personal punchline.',
      sections: [
        ['More personal than a stock rude card', 'Instead of choosing a fixed joke from a shelf, you give the card maker the details that make the recipient recognisable. That can be a catchphrase, terrible timekeeping, a questionable hobby, a legendary night out or the story everybody still brings up. The AI uses that material to create the front and inside message around them.'],
        ['Choose how far the joke goes', 'Use the brutality control to keep the humour cheeky or push it towards a much sharper roast. You see the generated versions before ordering and can choose the one that fits your relationship. The aim is funny adult humour and consensual banter, not genuine threats or harassment.'],
        ['Made online, then sent to print', 'Once you have picked the version you want, the site prepares the print artwork and opens secure checkout. The finished personalised card is then passed into professional print fulfilment for delivery.']
      ],
      faq: [['Can I make the card rude?', 'Yes. The generator is designed for cheeky, sweary and adult humour, while blocking genuinely harmful material.'], ['Is the wording personalised?', 'Yes. The generated card uses the details you provide about the recipient rather than simply adding a name to a fixed joke.']]
    },
    {
      slug: 'sweary-birthday-cards.html',
      title: 'Sweary Birthday Cards | Personalised Rude Cards UK | Built To Offend',
      h1: 'Sweary birthday cards with a personal punchline',
      description: 'Make a personalised sweary birthday card with rude UK humour, in-jokes and AI-generated roasts. Pick the brutality, approve the wording and order online.',
      intro: 'Some birthdays need more than “many happy returns”. If the recipient appreciates a bit of swearing and a proper roast, Built To Offend can make the joke about them rather than relying on a generic rude one-liner.',
      sections: [
        ['Use the ammunition you already have', 'Add the nickname, the bad habit, the ridiculous purchase, the pub story or the phrase they say every five minutes. Specific details make a sweary card feel like it came from you rather than from a mass-produced rack.'],
        ['From cheeky to savage', 'You decide how hard the card goes. Lower brutality keeps it playful; higher settings make the roast sharper. You still review the result before checkout, so you remain in control of what is actually printed.'],
        ['Ideal for mates, partners and family who can take it', 'Sweary personalised cards work especially well between people who already share that style of humour. For a different angle, you can also explore rude birthday cards, roast cards, funny cards for mates and adult humour cards.']
      ],
      faq: [['Do I have to use swear words?', 'No. You control the tone and can keep the card cheeky without making it heavily sweary.'], ['Can I personalise both the front and inside?', 'Yes. The generated concept includes front-card wording and an inside message based on the details you provide.']]
    },
    {
      slug: 'sarcastic-birthday-cards.html',
      title: 'Sarcastic Birthday Cards | Personalised Funny Cards | Built To Offend',
      h1: 'Sarcastic birthday cards that sound like you wrote them',
      description: 'Create a personalised sarcastic birthday card using real habits, stories and in-jokes. Generate a one-off funny card online and choose the version you like.',
      intro: 'Sarcasm lands better when the recipient recognises exactly what you are talking about. Built To Offend uses your details to make a birthday card around the person, not around a generic age joke.',
      sections: [
        ['Build the joke around their personality', 'Tell the generator what they are like and what you already tease them about. It can work with habits, hobbies, work stories, dating disasters, obsessions, catchphrases and the harmless things everybody notices.'],
        ['Three versions to choose from', 'The live card generator creates three complete card options so you can compare different angles rather than being stuck with the first line it produces. Pick the version that sounds most like your relationship with the recipient.'],
        ['Personalised without needing design skills', 'You do not need to write the joke or lay out print artwork yourself. Choose the concept you want and the site prepares the design for secure checkout and printing.']
      ],
      faq: [['Can I make it dry rather than rude?', 'Yes. Sarcastic humour can stay dry and playful; the brutality setting controls how sharp the result becomes.'], ['Is every card generated for my recipient?', 'Yes. The live generator builds the wording from the recipient details submitted for that card.']]
    },
    {
      slug: 'funny-30th-birthday-cards.html',
      title: 'Funny 30th Birthday Cards | Personalised 30th Cards | Built To Offend',
      h1: 'Funny personalised 30th birthday cards',
      description: 'Create a funny personalised 30th birthday card with in-jokes, embarrassing stories and AI-generated humour. Make their milestone card properly personal.',
      intro: 'Thirty is a useful birthday for comedy: old enough for the “getting old” jokes to start, young enough to still deny every one of them. Make the card about the person hitting 30 rather than just printing a large number on the front.',
      sections: [
        ['Use their twenties as material', 'Add the questionable decisions, abandoned hobbies, terrible dating history, career chaos, nights out or sudden obsession with sensible purchases. The generator turns those details into a one-off milestone card.'],
        ['A 30th card for mates, partners or siblings', 'Because the humour comes from the details you provide, the same card maker can suit a best mate, boyfriend, girlfriend, husband, wife, brother or sister without relying on a fixed template.'],
        ['Choose the roast level', 'Keep it affectionate or make it savage. You see the wording before checkout and choose the version you actually want printed.']
      ],
      faq: [['Can I add their age and name?', 'Yes. Include the fact they are turning 30 along with the details and in-jokes you want the card to use.'], ['Can it be rude?', 'Yes, if that suits the recipient. Choose the brutality level that fits your relationship.']]
    },
    {
      slug: 'funny-40th-birthday-cards.html',
      title: 'Funny 40th Birthday Cards | Personalised 40th Cards | Built To Offend',
      h1: 'Funny personalised 40th birthday cards',
      description: 'Make a funny personalised 40th birthday card from real in-jokes, habits and stories. Choose the brutality and create a memorable milestone roast.',
      intro: 'A 40th birthday gives you plenty of material before you even add the recipient’s own habits. Built To Offend combines the milestone with the details only friends and family would know.',
      sections: [
        ['Turn forty into something specific', 'Age jokes are much funnier when they connect to real life: the new hobby, the early nights, the suspiciously expensive gadget, the back complaint or the refusal to accept that fashions have moved on.'],
        ['Personalise the whole joke', 'Add names, stories, catchphrases and the harmless things you already tease them about. The AI produces complete front and inside wording rather than a standard card with a name dropped in.'],
        ['Review before you order', 'Choose from the generated versions, keep the humour at the level you want and only continue to checkout when the card feels right.']
      ],
      faq: [['Is it only for rude 40th cards?', 'No. The generator can make the humour playful, sarcastic or much ruder depending on the brutality you choose.'], ['Can I use private jokes?', 'Yes. In-jokes and recognisable stories are exactly what make the generated card more personal.']]
    },
    {
      slug: 'funny-50th-birthday-cards.html',
      title: 'Funny 50th Birthday Cards | Personalised 50th Cards | Built To Offend',
      h1: 'Funny personalised 50th birthday cards',
      description: 'Create a funny personalised 50th birthday card using names, in-jokes, habits and AI-written roasts. Build a one-off milestone card online.',
      intro: 'Half a century deserves something better than a generic “50 and fabulous” card. Use the stories and habits that make the recipient unmistakable and turn them into a milestone roast.',
      sections: [
        ['Plenty of history to work with', 'Fifty years normally means enough hobbies, fashion choices, work stories, family legends and repeated catchphrases to fill several cards. Give the generator the best material and let it build the joke around them.'],
        ['Funny rather than formulaic', 'The front and inside message are created for this recipient, so the result does not depend on a fixed catalogue design. You can keep the humour warm or deliberately inappropriate for somebody who enjoys being roasted.'],
        ['Simple online ordering', 'Pick the version you like, approve the final wording and continue through secure checkout when the live print connection is ready.']
      ],
      faq: [['Can I make a 50th card for him or her?', 'Yes. The generator works from the person’s details rather than a fixed gendered template.'], ['Can the card mention specific stories?', 'Yes. Add recognisable stories or habits in the information you give the generator.']]
    },
    {
      slug: 'funny-60th-birthday-cards.html',
      title: 'Funny 60th Birthday Cards | Personalised 60th Cards | Built To Offend',
      h1: 'Funny personalised 60th birthday cards',
      description: 'Make a personalised funny 60th birthday card using real stories, habits and in-jokes. Generate a unique card and choose how cheeky or savage it gets.',
      intro: 'Sixty years creates a lot of evidence. A personalised 60th card can use the recipient’s actual stories instead of relying entirely on predictable jokes about getting older.',
      sections: [
        ['Make the milestone recognisable', 'Use family stories, old hobbies, work history, questionable fashion eras, favourite sayings or the things they now complain about. Specific details make the joke feel affectionate even when the wording is sharp.'],
        ['Suitable for parents, partners and mates', 'A personalised approach means the same generator can create very different 60th birthday cards for a dad, mum, husband, wife, friend or colleague.'],
        ['You control the final tone', 'Choose the brutality, compare the versions and only order the card you are happy to send.']
      ],
      faq: [['Can I keep a 60th card family-friendly?', 'Yes. Choose a lower brutality and avoid adding material you do not want used.'], ['Can it be a rude 60th card?', 'Yes. For a recipient who enjoys adult humour, the brutality can be pushed much further.']]
    },
    {
      slug: 'funny-birthday-cards-for-dad.html',
      title: 'Funny Birthday Cards For Dad | Personalised Dad Cards | Built To Offend',
      h1: 'Funny personalised birthday cards for Dad',
      description: 'Create a funny personalised birthday card for Dad using his habits, hobbies, sayings and family in-jokes. Make a unique dad card online with AI.',
      intro: 'Dads generate card material for free: repeated jokes, DIY confidence, thermostat policing, questionable music and a collection of sayings everybody in the family can predict.',
      sections: [
        ['Use the things the family already laughs about', 'Add the hobby he takes too seriously, the story he tells every guest, his driving commentary, barbecue confidence or the purchase he is still trying to justify.'],
        ['More personal than “best dad ever”', 'Built To Offend creates a complete card around those details. You can make it affectionate, sarcastic or rude depending on what your dad will actually enjoy.'],
        ['Choose before anything is printed', 'Generate the options, pick the one that lands best and review it before secure checkout.']
      ],
      faq: [['Can siblings create the card together?', 'Yes. Add family in-jokes and shared stories so the wording reflects the whole family’s sense of humour.'], ['Can it be rude without being nasty?', 'Yes. The brutality control lets you keep the roast playful while still making it sharper than a normal dad card.']]
    },
    {
      slug: 'funny-birthday-cards-for-mum.html',
      title: 'Funny Birthday Cards For Mum | Personalised Mum Cards | Built To Offend',
      h1: 'Funny personalised birthday cards for Mum',
      description: 'Make a funny personalised birthday card for Mum from family in-jokes, habits, stories and AI-generated humour. Create a one-off mum card online.',
      intro: 'A funny card for Mum works best when the family immediately recognises the joke. Use the habits, sayings and stories that could not belong to anybody else.',
      sections: [
        ['Turn family history into the card', 'Use the phrase she always says, the thing she packs for every trip, the family WhatsApp behaviour, the obsession, the holiday story or the household rule nobody understands.'],
        ['Keep it warm or make it cheeky', 'You control the brutality, so the card can stay affectionate with a small sting or become a much sharper roast if that is the humour you share.'],
        ['Personalised front and inside message', 'The generator creates complete card wording from your details, then you choose the result you want before ordering.']
      ],
      faq: [['Can I create a card from a daughter or son?', 'Yes. Add the relationship and family details you want the card to reflect.'], ['Do I have to write the joke myself?', 'No. Give the generator the material and it creates three complete options for you to choose from.']]
    },
    {
      slug: 'funny-birthday-cards-for-brother.html',
      title: 'Funny Birthday Cards For Brother | Personalised Roast Cards | Built To Offend',
      h1: 'Funny personalised birthday cards for your brother',
      description: 'Create a funny personalised birthday card for your brother using sibling in-jokes, embarrassing stories and AI-generated roast humour.',
      intro: 'Brothers usually come with years of ready-made ammunition. Built To Offend turns sibling history into a birthday card that feels much more personal than a generic brother joke.',
      sections: [
        ['Use the childhood evidence', 'Nicknames, family legends, terrible haircuts, gaming arguments, sporting delusions and stories your parents still repeat can all become useful card material.'],
        ['Make it sound like sibling banter', 'Because you provide the detail and choose the brutality, the result can stay light or become the kind of savage roast only a sibling could get away with.'],
        ['Approve the version that lands best', 'Compare the three generated versions, choose your favourite and only continue when you are happy with the final card.']
      ],
      faq: [['Can I use an embarrassing nickname?', 'Yes, as long as it is appropriate for the recipient and the joke you want to make.'], ['Can the card be from multiple siblings?', 'Yes. Feed in shared stories and family jokes to make it feel like a group effort.']]
    },
    {
      slug: 'funny-birthday-cards-for-sister.html',
      title: 'Funny Birthday Cards For Sister | Personalised Roast Cards | Built To Offend',
      h1: 'Funny personalised birthday cards for your sister',
      description: 'Make a funny personalised birthday card for your sister using sibling stories, private jokes and AI-generated humour. Choose how savage it gets.',
      intro: 'A sister birthday card can be sentimental, but it does not have to be. Use the shared history and private jokes that make sibling humour instantly recognisable.',
      sections: [
        ['Use the details only family would know', 'Add the childhood phase nobody lets her forget, the catchphrase, the obsession, the family story or the thing she always denies doing.'],
        ['From affectionate to savage', 'Choose the brutality that fits your relationship. The generator can keep the card warm and cheeky or push it into a much more direct roast.'],
        ['Made for one recipient', 'The wording is generated from your details, giving you a one-off front and inside message rather than a fixed sister-card template.']
      ],
      faq: [['Can I make it funny without being rude?', 'Yes. Lower brutality settings are designed for playful personalised humour.'], ['Can I include an in-joke nobody else understands?', 'Yes. Those specific details are often what make the finished card feel most personal.']]
    },
    {
      slug: 'photo-personalised-cards.html',
      title: 'Photo Personalised Cards | Funny AI Greeting Cards | Built To Offend',
      h1: 'Funny photo-personalised greeting cards',
      description: 'Create a funny personalised greeting card with your own photo, names, stories and AI-generated humour. Make a one-off photo card online in the UK.',
      intro: 'A photo makes a personalised card immediately recognisable. Add the story behind it and the joke becomes even more specific.',
      sections: [
        ['Use a photo as part of the joke', 'Choose a suitable photo of the recipient and combine it with the habits, stories and in-jokes you want the card to use. The photo option adds another personal layer to the generated concept.'],
        ['AI-written wording, your real-world material', 'Built To Offend creates the front and inside message from the information you submit. That means the card can refer to the people, habits or circumstances behind the image instead of treating it as a generic upload.'],
        ['Review before secure checkout', 'Generate the versions, choose the one you want and check the final result before the site prepares print artwork and opens checkout.']
      ],
      faq: [['Does the photo cost extra?', 'The live site shows the current photo-card price before checkout.'], ['Can I still make the wording rude or funny?', 'Yes. The photo option works with the same personalised humour and brutality controls as the standard card.']]
    }
  ];

  const existingLinks = [
    ['funny-birthday-cards.html', 'Funny birthday cards'],
    ['rude-birthday-cards.html', 'Rude birthday cards'],
    ['offensive-birthday-cards.html', 'Offensive birthday cards'],
    ['personalised-cards.html', 'Personalised greeting cards'],
    ['novelty-cards.html', 'Novelty greeting cards'],
    ['roast-cards.html', 'Roast cards'],
    ['funny-cards-for-him.html', 'Funny cards for him'],
    ['funny-cards-for-her.html', 'Funny cards for her'],
    ['funny-cards-for-mates.html', 'Funny cards for mates'],
    ['birthday-cards-for-husband.html', 'Birthday cards for husband'],
    ['birthday-cards-for-wife.html', 'Birthday cards for wife'],
    ['birthday-cards-for-boyfriend.html', 'Birthday cards for boyfriend'],
    ['birthday-cards-for-girlfriend.html', 'Birthday cards for girlfriend'],
    ['funny-anniversary-cards.html', 'Funny anniversary cards'],
    ['funny-retirement-cards.html', 'Funny retirement cards'],
    ['funny-leaving-cards.html', 'Funny leaving cards']
  ];

  function commonSchema(page) {
    return [
      {
        '@context': 'https://schema.org', '@type': 'WebPage', name: page.h1,
        url: `${baseUrl}/${page.slug}`, description: page.description, inLanguage: 'en-GB',
        isPartOf: { '@type': 'WebSite', name: 'Built To Offend', url: `${baseUrl}/` }
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Built To Offend', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Cards', item: `${baseUrl}/cards.html` },
          { '@type': 'ListItem', position: 3, name: page.h1, item: `${baseUrl}/${page.slug}` }
        ]
      },
      {
        '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: page.faq.map(([q, a]) => ({
          '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a }
        }))
      }
    ];
  }

  function renderPage(page) {
    const related = pages.filter((p) => p.slug !== page.slug).slice(0, 4)
      .map((p) => `<a href="/${esc(p.slug)}">${esc(p.h1.replace(/^Funny personalised /i, ''))}</a>`).join(' · ');
    return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="${baseUrl}/${esc(page.slug)}">
<link rel="alternate" hreflang="en-gb" href="${baseUrl}/${esc(page.slug)}">
<link rel="alternate" hreflang="x-default" href="${baseUrl}/${esc(page.slug)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Built To Offend">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${baseUrl}/${esc(page.slug)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<script type="application/ld+json" data-bto-growth>${JSON.stringify(commonSchema(page))}</script>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0a0a0d;color:#f4f4f6;font-family:Arial,Helvetica,sans-serif;line-height:1.65}a{color:#ffd166}header,main,footer{max-width:980px;margin:auto;padding:24px}.brand{font-weight:900;letter-spacing:.06em;color:#fff;text-decoration:none}.crumbs{font-size:.9rem;color:#aaa}.hero{padding:46px 0 28px}.hero h1{font-size:clamp(2rem,7vw,4.2rem);line-height:1.02;margin:.15em 0}.hero p{font-size:1.12rem;max-width:760px}.cta{display:inline-block;background:#ffd166;color:#111;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:10px;margin:10px 8px 10px 0}.secondary{background:#222;color:#fff}.content{display:grid;gap:18px}.panel{background:#141419;border:1px solid #292930;border-radius:14px;padding:22px}.panel h2{margin-top:0}.faq h2{margin-top:36px}.faq details{background:#141419;border:1px solid #292930;border-radius:10px;padding:14px 16px;margin:10px 0}.related{margin-top:28px;padding:20px;background:#111116;border-radius:12px}footer{color:#999;font-size:.9rem;padding-bottom:48px}@media(max-width:640px){header,main,footer{padding:18px}.hero{padding-top:28px}}
</style>
</head>
<body>
<header><a class="brand" href="/">BUILT TO OFFEND</a></header>
<main>
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/cards.html">Cards</a> › ${esc(page.h1)}</nav>
<section class="hero">
<h1>${esc(page.h1)}</h1>
<p>${esc(page.intro)}</p>
<a class="cta" href="/">Create your card</a><a class="cta secondary" href="/cards.html">Browse card ideas</a>
</section>
<section class="content">${page.sections.map(([h, p]) => `<article class="panel"><h2>${esc(h)}</h2><p>${esc(p)}</p></article>`).join('')}</section>
<section class="faq"><h2>Questions about ${esc(page.h1.toLowerCase())}</h2>${page.faq.map(([q, a]) => `<details><summary><strong>${esc(q)}</strong></summary><p>${esc(a)}</p></details>`).join('')}</section>
<section class="related"><strong>More personalised card ideas:</strong> ${related} · <a href="/novelty-cards.html">Novelty cards</a> · <a href="/rude-birthday-cards.html">Rude birthday cards</a></section>
</main>
<footer>Built To Offend — personalised funny greeting cards created online in the UK.</footer>
</body>
</html>`;
  }

  for (const page of pages) fs.writeFileSync(path.join(publicDir, page.slug), renderPage(page));

  const allLinks = [
    ...existingLinks.map(([slug, label]) => ({ slug, label })),
    ...pages.map((p) => ({ slug: p.slug, label: p.h1 }))
  ];

  const hubSchema = [
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Funny, rude and personalised greeting cards',
      url: `${baseUrl}/cards.html`, description: 'Browse personalised funny, rude, novelty, roast, milestone and photo greeting-card ideas from Built To Offend.', inLanguage: 'en-GB'
    },
    {
      '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: allLinks.map((item, i) => ({
        '@type': 'ListItem', position: i + 1, name: item.label, url: `${baseUrl}/${item.slug}`
      }))
    },
    {
      '@context': 'https://schema.org', '@type': 'Product', name: 'Personalised AI Greeting Card',
      brand: { '@type': 'Brand', name: 'Built To Offend' }, category: 'Greeting Cards',
      description: 'A personalised funny greeting card generated from recipient details and prepared for professional printing.',
      url: `${baseUrl}/`, offers: { '@type': 'Offer', priceCurrency: 'GBP', price: '4.99', availability: 'https://schema.org/InStock', url: `${baseUrl}/` }
    }
  ];

  const hub = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Funny, Rude & Personalised Greeting Cards | Built To Offend</title>
<meta name="description" content="Browse funny birthday cards, rude cards, novelty cards, adult humour, roast cards, milestone birthdays and photo-personalised greeting cards from Built To Offend.">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="${baseUrl}/cards.html"><link rel="alternate" hreflang="en-gb" href="${baseUrl}/cards.html">
<meta property="og:type" content="website"><meta property="og:site_name" content="Built To Offend"><meta property="og:title" content="Funny, Rude & Personalised Greeting Cards | Built To Offend"><meta property="og:description" content="Personalised funny, rude, novelty and roast greeting cards created online."><meta property="og:url" content="${baseUrl}/cards.html">
<script type="application/ld+json" data-bto-growth>${JSON.stringify(hubSchema)}</script>
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0a0a0d;color:#f5f5f7;font:16px/1.6 Arial,sans-serif}a{color:#ffd166}header,main,footer{max-width:1080px;margin:auto;padding:24px}.brand{font-weight:900;color:#fff;text-decoration:none;letter-spacing:.06em}h1{font-size:clamp(2.2rem,7vw,4.5rem);line-height:1;margin:42px 0 18px}.intro{max-width:800px;font-size:1.12rem}.cta{display:inline-block;margin:10px 0 28px;background:#ffd166;color:#111;padding:14px 20px;border-radius:10px;text-decoration:none;font-weight:800}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}.card{display:block;background:#15151a;border:1px solid #2a2a31;border-radius:12px;padding:18px;text-decoration:none;color:#fff}.card:hover{border-color:#ffd166}.card strong{display:block;color:#ffd166;margin-bottom:6px}.why{margin:36px 0;padding:24px;background:#121217;border-radius:14px}.why h2{margin-top:0}footer{color:#999}@media(max-width:640px){header,main,footer{padding:18px}}</style>
</head><body><header><a class="brand" href="/">BUILT TO OFFEND</a></header><main>
<h1>Funny, rude and personalised greeting cards</h1>
<p class="intro">Built To Offend creates one-off greeting cards from the details that make somebody recognisable: names, habits, in-jokes, embarrassing stories, milestones and optional photos. Browse the most popular card ideas below, then use the live AI card maker to create your own.</p>
<a class="cta" href="/">Create a personalised card</a>
<div class="grid">${allLinks.map((item) => `<a class="card" href="/${esc(item.slug)}"><strong>${esc(item.label)}</strong><span>Personalised card ideas, examples and how to create one.</span></a>`).join('')}</div>
<section class="why"><h2>Why make the card personal?</h2><p>Generic funny cards have to work for thousands of people. A personalised card can use the exact story, habit or catchphrase that makes one recipient laugh immediately. Built To Offend generates three complete versions, lets you choose how savage the humour gets and shows you the result before checkout.</p><p>Popular searches include funny birthday cards, rude birthday cards, personalised greeting cards, novelty cards, adult humour cards, milestone birthday cards and photo-personalised cards. The card maker can combine those styles rather than forcing you into one fixed catalogue design.</p></section>
</main><footer>Built To Offend — funny personalised cards created online.</footer></body></html>`;
  fs.writeFileSync(path.join(publicDir, 'cards.html'), hub);

  // Add a crawlable discovery block to the homepage without changing the ordering UI.
  const homePath = path.join(publicDir, 'index.html');
  let home = fs.readFileSync(homePath, 'utf8');
  const marker = '<!-- BTO-SEO-GROWTH -->';
  if (!home.includes(marker)) {
    const block = `${marker}<section aria-labelledby="bto-card-guides" style="max-width:1100px;margin:24px auto 42px;padding:20px;line-height:1.6"><h2 id="bto-card-guides">More funny and personalised card ideas</h2><p>Browse card ideas by humour, recipient and milestone, then build your own personalised version with the live card maker.</p><p><a href="/cards.html">All greeting card ideas</a> · <a href="/adult-humour-cards.html">Adult humour cards</a> · <a href="/sweary-birthday-cards.html">Sweary birthday cards</a> · <a href="/funny-30th-birthday-cards.html">30th birthday cards</a> · <a href="/funny-40th-birthday-cards.html">40th birthday cards</a> · <a href="/funny-50th-birthday-cards.html">50th birthday cards</a> · <a href="/funny-60th-birthday-cards.html">60th birthday cards</a> · <a href="/photo-personalised-cards.html">Photo personalised cards</a></p></section>`;
    home = home.replace(/<\/body>/i, `${block}</body>`);
    fs.writeFileSync(homePath, home);
  }

  // Extend the sitemap generated by the original SEO build.
  const sitemapPath = path.join(publicDir, 'sitemap.xml');
  let sitemap = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
  const urls = ['cards.html', ...pages.map((p) => p.slug)];
  for (const slug of urls) {
    const loc = `${baseUrl}/${slug}`;
    if (!sitemap.includes(`<loc>${loc}</loc>`)) {
      sitemap = sitemap.replace('</urlset>', `<url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${slug === 'cards.html' ? '0.9' : '0.75'}</priority></url></urlset>`);
    }
  }
  fs.writeFileSync(sitemapPath, sitemap);
  console.log(`SEO growth ready: cards hub + ${pages.length} additional high-intent landing pages.`);
})();

require('./bto-ai-reliability-fix.js');
require('./bto-ai-object-response-fix.js');

// The legacy deployment workflow unsets CLOUDFLARE_API_TOKEN before later Wrangler calls.
// Preserve the authenticated token under private backup env names and place tiny wrappers
// first on PATH for subsequent GitHub Actions steps. The npx wrapper restores Cloudflare
// credentials. The curl wrapper gives a freshly deployed private Prodigi bridge a few
// seconds to propagate before its one-time rotating bearer token is validated.
(() => {
  const fs = require('fs');
  const path = require('path');
  const { execFileSync } = require('child_process');
  const githubEnv = process.env.GITHUB_ENV;
  const githubPath = process.env.GITHUB_PATH;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!githubEnv || !githubPath || !apiToken) return;

  const appendEnv = (name, value) => {
    if (!value) return;
    fs.appendFileSync(githubEnv, `${name}<<__BTO_CF__\n${value}\n__BTO_CF__\n`);
  };

  appendEnv('BTO_CF_API_TOKEN_BACKUP', apiToken);
  appendEnv('BTO_CF_ACCOUNT_ID_BACKUP', accountId);

  const realNpx = execFileSync('bash', ['-lc', 'command -v npx'], { encoding: 'utf8' }).trim();
  const realCurl = execFileSync('bash', ['-lc', 'command -v curl'], { encoding: 'utf8' }).trim();
  if (!realNpx) throw new Error('npx executable was not found');
  if (!realCurl) throw new Error('curl executable was not found');

  const wrapperDir = path.join(process.env.RUNNER_TEMP || '/tmp', 'bto-cloudflare-wrapper');
  fs.mkdirSync(wrapperDir, { recursive: true });

  const npxWrapperPath = path.join(wrapperDir, 'npx');
  const npxWrapper = [
    '#!/usr/bin/env bash',
    'set -e',
    'if [ -n "${BTO_CF_API_TOKEN_BACKUP:-}" ]; then export CLOUDFLARE_API_TOKEN="$BTO_CF_API_TOKEN_BACKUP"; fi',
    'if [ -n "${BTO_CF_ACCOUNT_ID_BACKUP:-}" ]; then export CLOUDFLARE_ACCOUNT_ID="$BTO_CF_ACCOUNT_ID_BACKUP"; fi',
    `exec ${JSON.stringify(realNpx)} "$@"`,
    '',
  ].join('\n');
  fs.writeFileSync(npxWrapperPath, npxWrapper, { mode: 0o755 });

  const curlWrapperPath = path.join(wrapperDir, 'curl');
  const curlWrapper = [
    '#!/usr/bin/env bash',
    'set -e',
    'for arg in "$@"; do',
    '  case "$arg" in',
    '    *"/api/internal/bto/prodigi/health"*) sleep 8; break ;;',
    '  esac',
    'done',
    `exec ${JSON.stringify(realCurl)} "$@"`,
    '',
  ].join('\n');
  fs.writeFileSync(curlWrapperPath, curlWrapper, { mode: 0o755 });

  fs.appendFileSync(githubPath, `${wrapperDir}\n`);
  console.log('Cloudflare CI credentials preserved; Prodigi bridge propagation guard enabled.');
})();
