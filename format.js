// Classificazione e formattazione del messaggio Telegram (layout "E2").
// Nessuna dipendenza esterna: tutto quello che qui dentro è testabile senza rete.

const TELEGRAM_MAX = 4000;

// Ordine di apparizione delle rubriche. Quelle senza notizie non vengono mostrate.
const CATEGORIES = [
  { key: 'aerei',      label: '✈️ AEREI' },
  { key: 'aeroporti',  label: '🛬 AEROPORTI' },
  { key: 'scenari',    label: '🏝 SCENARI' },
  { key: 'simulatore', label: '🛠 SIMULATORE' },
  { key: 'dcs',        label: '🎯 DCS' },
  { key: 'navigraph',  label: '🧭 NAVIGRAPH' },
  { key: 'altro',      label: '📰 ALTRE NOTIZIE' }
];

// Quadratino colorato davanti a ogni notizia
const BADGES = {
  msfs: '🟦',
  xplane: '🟧',
  dcs: '🟨',
  navigraph: '🧭',
  altro: '⬜'
};

const LEGEND = '🟦 MSFS · 🟧 X-Plane · 🟨 DCS · 🧭 Navigraph';
const BOT_LINE = '🤖 <i>Post automatico del bot</i>';
const SIGNATURE = 'Happy Landings\n<b>I-LAIR</b>';

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Il link finisce dentro un attributo href tra virgolette
function escAttr(url) {
  return esc(url).replace(/"/g, '&quot;');
}

// --- Classificazione di riserva (usata se Claude non risponde) ---

function guessSim(article) {
  const t = `${article.title} ${article.link}`;
  if (/navigraph|airac/i.test(t)) return 'navigraph';
  if (article.source === 'DCS Official' || /\bdcs\b/i.test(t)) return 'dcs';
  if (/x-?plane|\bxp ?1[12]\b|\bxp12\b/i.test(t)) return 'xplane';
  if (/msfs|microsoft flight|flight simulator|\bsu ?\d|marketplace/i.test(t)) return 'msfs';
  if (article.source === 'MSFS Addons') return 'msfs';
  return 'altro';
}

function guessCategory(article) {
  const t = article.title || '';
  if (/navigraph|airac/i.test(t)) return 'navigraph';
  if (article.source === 'DCS Official' || /\bdcs\b/i.test(t)) return 'dcs';
  if (/sim update|\bsu ?\d+(\.\d+)?\b|world update|city update|x-?plane 12\.\d/i.test(t)) return 'simulatore';
  if (/airport|airfield|aerodrome|airstrip|heliport|seaplane base|aeroporto/i.test(t)) return 'aeroporti';
  if (/scenery|island|region|landmarks|vegetation|mesh|photoreal|national park|city times/i.test(t)) return 'scenari';
  if (/aircraft|airliner|airbus|boeing|helicopter|\bjet\b|turboprop|cessna|piper|beechcraft|spitfire|phenom|citation|dash ?8|fokker|embraer|\bATR\b|\b(a[23]\d{2}|b?7[3-8]7)\b/i.test(t)) return 'aerei';
  return 'altro';
}

function normalizeClassification(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

// article: {source, title, link}; ai: {title, summary, category, sim} oppure null
function toItem(article, ai) {
  const categories = CATEGORIES.map(c => c.key);
  const sims = Object.keys(BADGES);

  // Navigraph e DCS non dipendono dal parere di Claude: le parole chiave sono inequivocabili
  const hardCategory = /navigraph|airac/i.test(article.title) ? 'navigraph'
    : (article.source === 'DCS Official' ? 'dcs' : null);

  const category = hardCategory ||
    normalizeClassification(ai && ai.category, categories, guessCategory(article));
  const sim = hardCategory || normalizeClassification(ai && ai.sim, sims, guessSim(article));

  return {
    category,
    sim: category === 'navigraph' ? 'navigraph' : (category === 'dcs' ? 'dcs' : sim),
    title: (ai && ai.title && ai.title.trim()) || article.title,
    summary: (ai && ai.summary && ai.summary.trim()) || '',
    link: article.link
  };
}

function renderItem(item, number) {
  const badge = BADGES[item.sim] || BADGES.altro;
  const line = `${number} · ${badge} <a href="${escAttr(item.link)}">${esc(item.title)}</a>`;
  return item.summary ? `${line}\n<i>${esc(item.summary)}</i>` : line;
}

function headerBlock(dateLabel, count) {
  const second = count > 0 ? `${dateLabel} · ${count} novità` : dateLabel;
  return `🤖 <b>FLIGHTSIM NEWS · WEEKLY</b>\n${esc(second)}`;
}

function footerBlock() {
  return `${LEGEND}\n${BOT_LINE}\n\n${SIGNATURE}`;
}

// Ritorna un array di messaggi HTML pronti da inviare (il primo con intestazione).
function buildMessages(items, dateLabel) {
  if (items.length === 0) {
    return [
      `${headerBlock(dateLabel, 0)}\n\n📰 Nessuna novità rispetto all'ultimo invio. Ci aggiorniamo al prossimo giro!\n\n${footerBlock()}`
    ];
  }

  const messages = [];
  let cur = headerBlock(dateLabel, items.length);
  let currentLabel = null;

  const flush = () => {
    messages.push(cur);
    cur = currentLabel ? `<b>${currentLabel}</b> <i>(segue)</i>` : '';
  };

  const add = (text) => {
    if ((cur + text).length > TELEGRAM_MAX) flush();
    cur += text;
  };

  let number = 1;
  for (const category of CATEGORIES) {
    const inCategory = items.filter(i => i.category === category.key);
    if (inCategory.length === 0) continue;
    inCategory.forEach((item, idx) => {
      const rendered = renderItem(item, number++);
      if (idx === 0) {
        // Se qui parte un nuovo messaggio, l'etichetta della rubrica è già nel testo
        currentLabel = null;
        add(`\n\n<b>${category.label}</b>\n${rendered}`);
        currentLabel = category.label;
      } else {
        add(`\n${rendered}`);
      }
    });
  }
  currentLabel = null;
  add(`\n\n${footerBlock()}`);
  messages.push(cur);

  return messages.map(m => m.trim());
}

module.exports = {
  TELEGRAM_MAX,
  CATEGORIES,
  BADGES,
  esc,
  guessCategory,
  guessSim,
  toItem,
  buildMessages
};
