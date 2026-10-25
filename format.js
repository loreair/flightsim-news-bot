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

// Cartelli gialli, nell'ordine in cui compaiono. Ogni cartello raccoglie le notizie
// di un simulatore e di una categoria (scritta sul cartello); quelli vuoti si saltano.
// "category: null" = tutte le notizie di quel simulatore.
const MSFS_XPLANE_CATEGORIES = ['aerei', 'aeroporti', 'scenari', 'simulatore', 'altro'];
const BLOCKS = [
  { sim: 'loreair', category: null, sign: 'loreair' },
  { sim: 'dcs', category: 'moduli', sign: 'dcs-moduli' },
  { sim: 'dcs', category: 'scenari', sign: 'dcs-scenari' },
  { sim: 'dcs', category: 'altro', sign: 'dcs' },
  ...MSFS_XPLANE_CATEGORIES.map(c => ({ sim: 'msfs', category: c, sign: `msfs-${c}` })),
  ...MSFS_XPLANE_CATEGORIES.map(c => ({ sim: 'xplane', category: c, sign: `xplane-${c}` })),
  { sim: 'navigraph', category: null, sign: 'navigraph' },
  { sim: 'altro', category: null, sign: 'altro' }
];

const CATEGORY_KEYS = ['aerei', 'aeroporti', 'scenari', 'simulatore', 'moduli', 'dcs', 'navigraph', 'altro'];
const SIM_KEYS = ['msfs', 'xplane', 'dcs', 'navigraph', 'altro'];

// In quale cartello finisce una notizia: la categoria "grezza" viene ricondotta
// a quelle che il cartello del suo simulatore sa mostrare.
function blockCategory(item) {
  if (item.sim === 'dcs') return ['moduli', 'scenari'].includes(item.category) ? item.category : 'altro';
  if (item.sim === 'msfs' || item.sim === 'xplane') {
    return MSFS_XPLANE_CATEGORIES.includes(item.category) ? item.category : 'altro';
  }
  return null;
}

const BOT_LINE = '<i>Post automatico del bot</i>';
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

function guessDcsKind(title) {
  const t = title || '';
  if (/\bmaps?\b|terrain|scenery|dev report|south iraq/i.test(t)) return 'scenari';
  if (/\bmig-?\d+|\bf-\d+|\bf\/a-\d+|\ba-10|\bsu-\d+|\bah-\d+|\bjf-17|\bmirage|module|flogger|tomcat|hornet|viper|helicopter|early access/i.test(t)) return 'moduli';
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

  const sim = forced || pick(ai && ai.sim, SIM_KEYS, guessSim(article));
  // Le notizie DCS si dividono in "moduli" (aerei e altro materiale giocabile) e "scenari" (mappe)
  const category = forced === 'navigraph' ? 'navigraph'
    : (sim === 'dcs'
      ? pick(ai && ai.category, ['moduli', 'scenari'], guessDcsKind(article.title))
      : pick(ai && ai.category, CATEGORY_KEYS, guessCategory(article)));

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

// Righe di un cartello. Ogni riga è un pezzo di testo che non va spezzato.
function blockLines(block, items, videos, counter) {
  if (block.sim === 'loreair') {
    return ['<b>🎬 I video della settimana</b>', ...videos.map(renderVideo)];
  }
  return items
    .filter(i => i.sim === block.sim && (block.category === null || blockCategory(i) === block.category))
    .map(i => renderItem(i, counter.next++));
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
  const header = ['<b>FLIGHTSIM NEWS · WEEKLY</b>'];
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
  for (const block of BLOCKS) {
    const lines = blockLines(block, items, videos, counter);
    if (lines.length === 0) continue;

    const chunks = splitLines(lines, CAPTION_MAX, TEXT_MAX);
    chunks.forEach((chunk, idx) => {
      posts.push(idx === 0 ? { photo: block.sign, text: chunk } : { text: chunk });
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
