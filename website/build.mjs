// Builds the static site in ./public from ./pages and the repository's
// PRIVACY.md, so the policy has one source and the app, the App Store listing
// and the website always show the same text. No dependencies: run with
// `node website/build.mjs` (also run by `firebase deploy` as a predeploy step).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const outDir = join(here, 'public');

const SITE = {
  name: 'Mind to Mouth',
  url: 'https://mind-to-mouth.web.app',
  repo: 'https://github.com/ufukceyhanli/mind-to-mouth',
  issues: 'https://github.com/ufukceyhanli/mind-to-mouth/issues',
};

// ---- Markdown (the subset PRIVACY.md uses) ---------------------------------

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(md) {
  let s = escapeHtml(md);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/&lt;(https?:\/\/[^\s]+?)&gt;/g, (_, url) => `<a href="${url}">${url}</a>`);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Headings, paragraphs, bullet lists, bold, inline code, links, one italic line. */
function markdownToHtml(md) {
  const out = [];
  let paragraph = [];
  let list = [];
  const flush = () => {
    if (paragraph.length) {
      const text = paragraph.join(' ');
      const italic = text.match(/^_(.+)_$/);
      out.push(italic ? `<p class="updated">${inline(italic[1])}</p>` : `<p>${inline(text)}</p>`);
      paragraph = [];
    }
    if (list.length) {
      out.push(`<ul>\n${list.map((li) => `  <li>${inline(li)}</li>`).join('\n')}\n</ul>`);
      list = [];
    }
  };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
    } else if (line.startsWith('# ')) {
      flush();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      flush();
      const text = line.slice(3);
      out.push(`<h2 id="${slug(text)}">${inline(text)}</h2>`);
    } else if (line.startsWith('- ')) {
      if (paragraph.length) flush();
      list.push(line.slice(2));
    } else {
      if (list.length) flush();
      paragraph.push(line.trim());
    }
  }
  flush();
  return out.join('\n');
}

// ---- Layout ----------------------------------------------------------------

function layout({ title, description, path, body, wide = false }) {
  const fullTitle = path === '/' ? `${SITE.name} – speak for two minutes, every day` : `${title} – ${SITE.name}`;
  const nav = [
    ['/', 'Home'],
    ['/support', 'Support'],
    ['/privacy', 'Privacy'],
  ]
    .map(([href, label]) =>
      href === path ? `<a href="${href}" aria-current="page">${label}</a>` : `<a href="${href}">${label}</a>`,
    )
    .join('\n        ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:title" content="${escapeHtml(fullTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${SITE.url}/icon.png">
  <meta property="og:url" content="${SITE.url}${path === '/' ? '' : path}">
  <meta name="theme-color" content="#FDF4EA">
  <link rel="icon" href="/favicon.png">
  <link rel="apple-touch-icon" href="/icon.png">
  <link rel="canonical" href="${SITE.url}${path === '/' ? '' : path}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="site-header">
    <div class="container header-row">
      <a class="brand" href="/">
        <img src="/icon.png" alt="" width="36" height="36">
        <span>${SITE.name}</span>
      </a>
      <nav aria-label="Site">
        ${nav}
      </nav>
      <a class="button small header-cta" href="${SITE.repo}">Get the app</a>
    </div>
  </header>

  <main class="container${wide ? ' wide' : ''}">
${body}
  </main>

  <footer class="site-footer">
    <div class="container footer-row">
      <span>© ${new Date().getFullYear()} Ufuk Ceyhanli</span>
      <nav aria-label="Footer">
        <a href="/privacy">Privacy policy</a>
        <a href="/support">Support</a>
        <a href="${SITE.repo}">Source on GitHub</a>
      </nav>
    </div>
  </footer>
</body>
</html>
`;
}

// ---- Pages -----------------------------------------------------------------

const pages = [
  {
    file: 'index.html',
    path: '/',
    title: 'Home',
    description:
      'Mind to Mouth is a daily speaking drill for iPhone. One random word, two minutes of talking, a score and coaching notes. Recordings stay on your phone.',
    body: readFileSync(join(here, 'pages', 'index.html'), 'utf8'),
    wide: true,
  },
  {
    file: 'support.html',
    path: '/support',
    title: 'Support',
    description:
      'Help with Mind to Mouth: deleting talks, withdrawing consent, deleting your account, reporting a problem with the AI coach, and how to contact the developer.',
    body: readFileSync(join(here, 'pages', 'support.html'), 'utf8'),
  },
  {
    file: 'privacy.html',
    path: '/privacy',
    title: 'Privacy policy',
    description:
      'What Mind to Mouth does with your data: recordings stay on your phone, audio is sent to NVIDIA’s AI model service only after you agree, and accounts hold nothing but an email address.',
    body: `<article class="prose">\n${markdownToHtml(readFileSync(join(repoRoot, 'PRIVACY.md'), 'utf8'))}\n</article>`,
  },
  {
    file: '404.html',
    path: '/404',
    title: 'Page not found',
    description: 'That page does not exist.',
    body: `<article class="prose center">
<h1>Page not found</h1>
<p>There is nothing here. Try the <a href="/">home page</a>, the <a href="/privacy">privacy policy</a> or <a href="/support">support</a>.</p>
</article>`,
  },
];

mkdirSync(outDir, { recursive: true });
for (const page of pages) {
  writeFileSync(join(outDir, page.file), layout(page));
  console.log(`wrote public/${page.file}`);
}
