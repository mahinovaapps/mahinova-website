// Builds the Bangla (/bn/) and Hindi (/hi/) copies of the site from the English pages.
//   node i18n/build.js extract   writes i18n/strings.json (every English text that needs translating)
//   node i18n/build.js           writes bn/*.html and hi/*.html from i18n/bn.json and i18n/hi.json,
//                                adds language links and hreflang to every page, and rewrites sitemap.xml.
// Edit the English pages as usual, then run this script; it lists any text that still has no translation.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://mahinova.in/';
const PAGES = ['index.html', 'services.html', 'products.html', 'restaurant.html', 'portfolio.html', 'about.html', 'contact.html'];
const LANGS = {
  en: { name: 'English', locale: 'en_IN', dir: '', appDesc: 'Mobile apps, websites and software for small businesses across India.' },
  bn: { name: 'বাংলা', locale: 'bn_IN', dir: 'bn/', appDesc: 'সারা ভারতের ছোট ব্যবসার জন্য মোবাইল অ্যাপ, ওয়েবসাইট আর সফটওয়্যার।' },
  hi: { name: 'हिन्दी', locale: 'hi_IN', dir: 'hi/', appDesc: 'पूरे भारत के छोटे व्यवसायों के लिए मोबाइल ऐप, वेबसाइट और सॉफ़्टवेयर।' }
};
const INLINE = new Set(['strong', 'em', 'b', 'i', 'small', 'code', 'span', 'a', 'abbr', 'mark', 'sup', 'sub']);
const VOID_INLINE = new Set(['br', 'wbr']);
const ATTRS = ['alt', 'aria-label', 'placeholder', 'title'];
const META = /^(description|og:title|og:description|og:image:alt|twitter:title|twitter:description)$/;
const LD_KEYS = new Set(['name', 'description', 'text', 'slogan', 'alternateName']);

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const bare = (s) => norm(s.replace(/<[^>]+>|&[a-z]+;/g, ' '));
const hasWords = (s) => /[A-Za-z]{2}/.test(bare(s)) && bare(s) !== 'mahinova';
// "<a href=..>Home</a>" is translated as "Home": tags that wrap the whole run stay out of the text.
function peel(s) {
  const m = s.match(/^(<([a-z]+)\b[^>]*>)([\s\S]*)(<\/\2>)$/);
  if (!m || new RegExp('<' + m[2] + '[\\s>]').test(m[3])) return null;
  return [m[1], m[3], m[4]];
}
const tokenize = (html) => html.match(/<!--[\s\S]*?-->|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>|[^<]+/g);
const tagName = (t) => (t.match(/^<\/?([a-zA-Z0-9-]+)/) || [])[1];

// Walks the tokens and calls onText(segmentHtml) for each run of text with inline tags,
// returning the page with each run replaced by what onText returns.
function segments(html, onText, onAttr, onLd) {
  const tok = tokenize(html);
  const out = [];
  let seg = null, stack = [];
  const flush = () => {
    if (!seg) return;
    const raw = seg.join('');
    const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
    let pre = '', body = m[2], post = '', p;
    while ((p = peel(body))) { pre += p[0]; body = p[1]; post = p[2] + post; }
    out.push(hasWords(body) ? m[1] + pre + onText(body) + post + m[3] : raw);
    seg = null; stack = [];
  };
  for (let i = 0; i < tok.length; i++) {
    let t = tok[i];
    if (t.startsWith('<script')) {
      flush();
      out.push(/application\/ld\+json/.test(t) ? t.replace(/(<script[^>]*>)([\s\S]*)(<\/script>)/, (a, o, body, c) => o + onLd(body) + c) : t);
      continue;
    }
    if (t.startsWith('<!--') || t.startsWith('<style')) { flush(); out.push(t); continue; }
    if (t[0] === '<') {
      t = t.replace(/\s(alt|aria-label|placeholder|title)="([^"]*)"/g, (a, k, v) => ' ' + k + '="' + (hasWords(v) ? onAttr(v) : v) + '"');
      if (/^<meta\b/.test(t)) {
        const key = (t.match(/(?:name|property)="([^"]+)"/) || [])[1] || '';
        if (META.test(key)) t = t.replace(/content="([^"]*)"/, (a, v) => 'content="' + onAttr(v) + '"');
      }
      const name = (tagName(t) || '').toLowerCase(), close = t[1] === '/';
      if (seg) {
        if (VOID_INLINE.has(name)) { seg.push(t); continue; }
        if (INLINE.has(name) && !close) {
          // A new inline tag right after a finished one (like links in a menu) starts a new run.
          const prevText = seg.slice().reverse().find((x) => x[0] !== '<' ? /\S/.test(x) : true);
          if (stack.length || (prevText && prevText[0] !== '<')) { seg.push(t); stack.push(name); continue; }
        }
        if (INLINE.has(name) && close && stack[stack.length - 1] === name) { seg.push(t); stack.pop(); continue; }
        flush();
      }
      if (INLINE.has(name) && !close && !/\/>$/.test(t)) { seg = [t]; stack = [name]; continue; }
      out.push(t);
      continue;
    }
    if (seg) { seg.push(t); continue; }
    if (/\S/.test(t)) { seg = [t]; stack = []; } else out.push(t);
  }
  flush();
  return out.join('');
}

function ldStrings(body, fn) {
  const walk = (v, k) => {
    if (typeof v === 'string') return LD_KEYS.has(k) && hasWords(v) && !/^https?:/.test(v) ? fn(v) : v;
    if (Array.isArray(v)) return v.map((x) => walk(x, k));
    if (v && typeof v === 'object') { const o = {}; for (const key of Object.keys(v)) o[key] = walk(v[key], key); return o; }
    return v;
  };
  return '\n  ' + JSON.stringify(walk(JSON.parse(body), ''), null, 2).replace(/\n/g, '\n  ') + '\n  ';
}

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
// Language links and hreflang are generated, so strip them before reading a page.
const clean = (html) => html.replace(/\n\s*<!-- i18n:hreflang -->[\s\S]*?<!-- \/i18n:hreflang -->/, '').replace(/\n\s*<!-- i18n:lang -->[\s\S]*?<!-- \/i18n:lang -->/g, '');

function extract() {
  const seen = new Map();
  const add = (page) => (s) => { const k = norm(s); if (!seen.has(k)) seen.set(k, page); return s; };
  for (const p of PAGES) {
    const f = add(p);
    segments(clean(read(p)), f, f, (body) => { ldStrings(body, f); return body; });
  }
  const list = [...seen.entries()].map(([en, page]) => ({ page, en }));
  fs.writeFileSync(path.join(__dirname, 'strings.json'), JSON.stringify(list, null, 1));
  console.log(list.length + ' strings, ' + list.reduce((n, x) => n + x.en.length, 0) + ' characters');
}

const pageUrl = (code, p) => SITE + LANGS[code].dir + (p === 'index.html' ? '' : p);

function head(code, p) {
  return '\n  <!-- i18n:hreflang -->\n' + Object.keys(LANGS).map((c) => '  <link rel="alternate" hreflang="' + c + '" href="' + pageUrl(c, p) + '">\n').join('') +
    '  <link rel="alternate" hreflang="x-default" href="' + pageUrl('en', p) + '">\n  <!-- /i18n:hreflang -->';
}

// Links to the same page in the other languages, shown as buttons in the top bar.
function langLinks(code, p) {
  const up = code === 'en' ? '' : '../';
  return '\n      <!-- i18n:lang --><div class="lang-switch">' + Object.keys(LANGS).filter((c) => c !== code).map((c) =>
    '<a href="' + up + LANGS[c].dir + (p === 'index.html' ? (LANGS[c].dir ? '' : 'index.html') : p) + '" hreflang="' + c + '" lang="' + c + '">' + LANGS[c].name + '</a>').join('') + '</div><!-- /i18n:lang -->';
}

function addI18n(html, code, p) {
  html = html.replace(/(<link rel="canonical"[^>]*>)/, '$1' + head(code, p));
  return html.replace(/(\n\s*<button class="menu-toggle")/, langLinks(code, p) + '$1');
}

function build() {
  const missing = {};
  for (const p of PAGES) fs.writeFileSync(path.join(ROOT, p), addI18n(clean(read(p)), 'en', p));
  for (const code of ['bn', 'hi']) {
    const dict = JSON.parse(fs.readFileSync(path.join(__dirname, code + '.json'), 'utf8'));
    const tr = (s) => { const k = norm(s); if (dict[k] !== undefined) return dict[k]; (missing[code] = missing[code] || new Set()).add(k); return s; };
    fs.mkdirSync(path.join(ROOT, code), { recursive: true });
    for (const p of PAGES) {
      let html = segments(clean(read(p)), tr, tr, (body) => ldStrings(body, tr));
      html = html
        .replace('<html lang="en">', '<html lang="' + code + '">')
        .replace(/content="en_IN"/g, 'content="' + LANGS[code].locale + '"')
        .replace(/"inLanguage": "en-IN"/g, '"inLanguage": "' + code + '-IN"')
        .replace(/https:\/\/mahinova\.in\/((?:[a-z-]+\.html)?(?:#[\w-]*)?)(?=["'\s<])/g, (a, rest) => SITE + code + '/' + rest)
        .replace(/(href|src)="(assets\/|styles\.css|main\.js|favicon)/g, '$1="../$2')
        .replace(/href="https:\/\/tools\.mahinova\.in\/"/g, 'href="https://tools.mahinova.in/' + code + '/"');
      fs.writeFileSync(path.join(ROOT, code, p), '<!-- Generated by i18n/build.js from ../' + p + '. Do not edit by hand. -->\n' + addI18n(html, code, p));
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    Object.keys(LANGS).map((code) => PAGES.map((p) => '  <url>\n    <loc>' + pageUrl(code, p) + '</loc>\n    <lastmod>' + today + '</lastmod>\n' +
      Object.keys(LANGS).map((c) => '    <xhtml:link rel="alternate" hreflang="' + c + '" href="' + pageUrl(c, p) + '"/>\n').join('') +
      '    <xhtml:link rel="alternate" hreflang="x-default" href="' + pageUrl('en', p) + '"/>\n  </url>\n').join('')).join('') + '</urlset>\n');
  for (const [code, set] of Object.entries(missing)) console.log(code + ': ' + set.size + ' strings still in English:\n  ' + [...set].join('\n  '));
  // Installable app (PWA): one app, opening in the language it was installed from.
  for (const [code, L] of Object.entries(LANGS)) {
    fs.writeFileSync(path.join(ROOT, L.dir, 'manifest.webmanifest'), JSON.stringify({
      id: '/', name: 'mahinova', short_name: 'mahinova', description: L.appDesc, lang: code,
      start_url: '/' + L.dir, scope: '/', display: 'standalone', orientation: 'portrait',
      background_color: '#1E1038', theme_color: '#1E1038',
      icons: [
        { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/assets/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/assets/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
    }, null, 1) + '\n');
  }
  console.log('Built bn/ and hi/ (' + PAGES.length + ' pages each) sitemap.xml and the app manifests');
}

if (process.argv[2] === 'extract') extract(); else build();
