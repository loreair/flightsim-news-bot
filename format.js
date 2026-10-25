// Classificazione e impaginazione del messaggio Telegram.
// Nessuna dipendenza esterna: tutto quello che qui dentro è testabile senza rete.
//
// Il messaggio è una sequenza di "post":
//   - il banner con i loghi e l'intestazione (foto + didascalia)
//   - un cartello giallo per rubrica (foto + didascalia con le notizie)
//   - testo semplice per ciò che non entra nella didascalia
// Telegram limita le didascalie a 1024 caratteri e i testi a 4096.

const CAPTION_MAX = 1000;
const TEXT_MAX = 4000;

// Rubriche per simulatore, nell'ordine in cui compaiono. Quelle vuote vengono saltate.
const SECTIONS = [
  { key: 'loreair',   sign: 'loreair' },
  { key: 'dcs',       sign: 'dcs' },
  { key: 'msfs',      sign: 'msfs',      subheadings: true },
  { key: 'xplane',    sign: 'xplane',    subheadings: true },
  { key: 'navigraph', sign: 'navigraph' },
  { key: 'altro',     sign: 'altro' }
];

// Sottotitoli dentro le rubriche MSFS e X-Plane
const SUBHEADINGS = [
  { key: 'aerei',      label: '✈️ Aerei' },
  { key: 'aeroporti',  label: '🛬 Aeroporti' },
  { key: 'scenari',    label: '🏝 Scenari' },
  { key: 'simulatore', label: '🛠 Simulatore' },
  { key: 'altro',      label: '📰 Altro' }
];

const CATEGORY_KEYS = ['aerei', 'aeroporti', 'scenari', 'simulatore', 'dcs', 'navigraph', 'altro'];
const SIM_KEYS = ['msfs', 'xplane', 'dcs', 'navigraph', 'altro'];

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

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

// article: {source, title, link}; ai: {title, summary, category, sim} oppure null
function toItem(article, ai) {
  // Navigraph e DCS non dipendono dal parere di Claude: le parole chiave sono inequivocabili
  const forced = /navigraph|airac/i.test(article.title) ? 'navigraph'
    : (article.source === 'DCS Official' ? 'dcs' : null);

  const category = forced || pick(ai && ai.category, CATEGORY_KEYS, guessCategory(article));
  const sim = forced || pick(ai && ai.sim, SIM_KEYS, guessSim(article));

  return {
    category,
    sim,
    title: (ai && ai.title && ai.title.trim()) || article.title,
    summary: (ai && ai.summary && ai.summary.trim()) || '',
    link: article.link
  };
}

// --- Impaginazione ---

function renderItem(item, number) {
  const line = `${number} · <a href="${escAttr(item.link)}">${esc(item.title)}</a>`;
  return item.summary ? `${line}\n<i>${esc(item.summary)}</i>` : line;
}

function renderVideo(video) {
  return `▶️ <a href="${escAttr(video.link)}">${esc(video.title)}</a>`;
}

// Costruisce le "righe" di una rubrica. Ogni riga è un pezzo di testo che non va spezzato.
function sectionLines(section, items, videos, counter) {
  if (section.key === 'loreair') {
    return ['<b>🎬 I video della settimana</b>', ...videos.map(renderVideo)];
  }

  const ofSim = items.filter(i => i.sim === section.key);
  if (!section.subheadings) {
    return ofSim.map(i => renderItem(i, counter.next++));
  }

  const lines = [];
  for (const sub of SUBHEADINGS) {
    const inSub = ofSim.filter(i => i.category === sub.key);
    if (inSub.length === 0) continue;
    lines.push(`<b>${sub.label}</b>`);
    inSub.forEach(i => lines.push(renderItem(i, counter.next++)));
  }
  // Notizie con una categoria fuori elenco (es. "dcs" su MSFS): vanno in fondo
  const known = new Set(SUBHEADINGS.map(s => s.key));
  const rest = ofSim.filter(i => !known.has(i.category));
  if (rest.length) {
    lines.push(`<b>${SUBHEADINGS[SUBHEADINGS.length - 1].label}</b>`);
    rest.forEach(i => lines.push(renderItem(i, counter.next++)));
  }
  return lines;
}

// Quante righe stanno in una didascalia: il resto prosegue in messaggi di testo.
function splitLines(lines, firstMax, nextMax) {
  const chunks = [];
  let cur = '';
  let max = firstMax;
  for (const line of lines) {
    const candidate = cur ? `${cur}\n${line}` : line;
    if (candidate.length > max && cur) {
      chunks.push(cur);
      cur = line;
      max = nextMax;
    } else {
      cur = candidate;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function footerBlock() {
  return `${BOT_LINE}\n\n${SIGNATURE}`;
}

// items: notizie già classificate; videos: [{title, link}]
// Ritorna post: {photo: 'banner'|chiave cartello, text} oppure {text}
function buildPosts(items, videos, dateLabel) {
  const header = [`🤖 <b>FLIGHTSIM NEWS · WEEKLY</b>`];
  const counts = [];
  if (items.length) counts.push(`${items.length} novità`);
  if (videos.length) counts.push(`${videos.length} video`);
  header.push(esc([dateLabel, ...counts].join(' · ')));

  const posts = [];

  if (items.length === 0 && videos.length === 0) {
    posts.push({
      photo: 'banner',
      text: `${header.join('\n')}\n\n📰 Nessuna novità rispetto all'ultimo invio. Ci aggiorniamo al prossimo giro!\n\n${footerBlock()}`
    });
    return posts;
  }

  posts.push({ photo: 'banner', text: header.join('\n') });

  const counter = { next: 1 };
  for (const section of SECTIONS) {
    const lines = sectionLines(section, items, videos, counter);
    if (lines.length === 0) continue;

    const chunks = splitLines(lines, CAPTION_MAX, TEXT_MAX);
    chunks.forEach((chunk, idx) => {
      posts.push(idx === 0 ? { photo: section.sign, text: chunk } : { text: chunk });
    });
  }

  // La chiusura sta nell'ultimo post, se entra; altrimenti in un messaggio a parte
  const last = posts[posts.length - 1];
  const limit = last.photo ? CAPTION_MAX : TEXT_MAX;
  if (posts.length > 1 && `${last.text}\n\n${footerBlock()}`.length <= limit) {
    last.text = `${last.text}\n\n${footerBlock()}`;
  } else {
    posts.push({ text: footerBlock() });
  }

  return posts;
}

module.exports = {
  CAPTION_MAX,
  TEXT_MAX,
  esc,
  guessCategory,
  guessSim,
  toItem,
  buildPosts
};
