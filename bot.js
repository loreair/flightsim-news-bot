const axios = require('axios');
const cheerio = require('cheerio');
const RSSParser = require('rss-parser');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { toItem, buildMessages } = require('./format');

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

// DRY_RUN=1: raccoglie le news e stampa i messaggi in console, senza inviare nulla
// a Telegram e senza toccare sent_links.json. Utile per provare il layout.
const DRY_RUN = process.env.DRY_RUN === '1';

if (!DRY_RUN && (!token || !chatId)) {
  console.error('❌ TELEGRAM_TOKEN o TELEGRAM_CHAT_ID mancanti!');
  process.exit(1);
}
if (!DRY_RUN && !anthropicKey) {
  console.error('❌ ANTHROPIC_API_KEY mancante!');
  process.exit(1);
}

const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

// Banner con i loghi, mostrato sopra il testo come anteprima di link
const BANNER_URL = 'https://raw.githubusercontent.com/loreair/flightsim-news-bot/main/assets/banner.png';
const MAX_ARTICLES = 20;

// rss-parser configurato con headers che prevengono il 415
// Alcuni server WordPress/Cloudflare rifiutano richieste senza Accept esplicito
const parser = new RSSParser({
  headers: {
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    'User-Agent': 'Mozilla/5.0 (compatible; FlightSimNewsBot/1.0; +https://github.com/loreair/flightsim-news-bot)'
  },
  timeout: 10000
});

// --- Cache link già inviati ---

const CACHE_FILE = path.join(__dirname, 'sent_links.json');
const MAX_CACHE_SIZE = 500;

function loadSentLinks() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      return new Set(Array.isArray(data) ? data : []);
    }
  } catch (e) {
    console.warn('⚠️ Impossibile leggere sent_links.json, si parte da zero:', e.message);
  }
  return new Set();
}

function saveSentLinks(sentSet) {
  try {
    let arr = Array.from(sentSet);
    if (arr.length > MAX_CACHE_SIZE) {
      arr = arr.slice(arr.length - MAX_CACHE_SIZE);
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(arr, null, 2), 'utf8');
    console.log(`💾 Cache aggiornata: ${arr.length} link salvati.`);
  } catch (e) {
    console.error('❌ Impossibile salvare sent_links.json:', e.message);
  }
}

// --- Telegram: verifica bot e invia con auto-split ---

async function verifyBot() {
  try {
    const me = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    console.log('✅ Bot valido:', me.data.result.username);
  } catch (e) {
    console.error('❌ TELEGRAM_TOKEN non valido:', e.response?.data || e.message);
    process.exit(1);
  }
}

// Il primo messaggio mostra il banner sopra il testo; gli altri non hanno anteprime.
async function sendMessage(text, { withBanner = false, silent = false } = {}) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_notification: silent,
    link_preview_options: withBanner
      ? { url: BANNER_URL, show_above_text: true, prefer_large_media: true }
      : { is_disabled: true }
  };
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, payload);
  } catch (e) {
    if (withBanner) {
      // Se il banner dà problemi, il messaggio parte comunque, senza anteprima
      console.warn('⚠️ Invio con banner fallito, riprovo senza:', e.response?.data || e.message);
      try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          ...payload,
          link_preview_options: { is_disabled: true }
        });
        return;
      } catch (e2) {
        console.error('❌ Errore sendMessage:', e2.response?.data || e2.message);
        process.exit(1);
      }
    }
    console.error('❌ Errore sendMessage:', e.response?.data || e.message);
    process.exit(1);
  }
}

async function sendTelegram(messages) {
  if (DRY_RUN) {
    messages.forEach((m, i) => {
      console.log(`\n----- MESSAGGIO ${i + 1}/${messages.length} (${m.length} caratteri) -----\n${m}`);
    });
    return;
  }

  await verifyBot();

  for (let i = 0; i < messages.length; i++) {
    await sendMessage(messages[i], { withBanner: i === 0, silent: i > 0 });
    if (i < messages.length - 1) await new Promise(r => setTimeout(r, 500));
  }
}

// --- Titolo breve, riassunto e classificazione in italiano via Claude Haiku 4.5 ---

async function analyzeArticle(article) {
  if (!anthropic) return null;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Sei un assistente per appassionati di simulazione di volo. Ti do il titolo di un articolo; basati SOLO sul titolo e non inventare dettagli.
Rispondi SOLO con un oggetto JSON con questi campi:
- "title": titolo breve in italiano, massimo 9 parole; mantieni invariati nomi di prodotti, sviluppatori e sigle (es. iniBuilds, A350, MSFS 2024)
- "summary": una sola frase breve in italiano, massimo 110 caratteri, senza emoji
- "category": una tra "aerei", "aeroporti", "scenari", "simulatore", "dcs", "navigraph", "altro" (simulatore = aggiornamenti del simulatore stesso come Sim Update o World Update; navigraph = dati AIRAC e novità dei programmi Navigraph; dcs = qualsiasi novità di DCS World)
- "sim": uno tra "msfs", "xplane", "dcs", "navigraph", "altro"

Titolo: ${article.title}\nURL: ${article.link}`
      }]
    });
    const raw = response.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) {
    console.error(`Errore analisi Claude per "${article.title}":`, e.message);
    return null;
  }
}

// --- Fonti RSS ---
// Il parser ha già gli headers corretti a livello globale.
// Timeout e retry per resilienza su fonti instabili.

async function getRssFeed(url, sourceName, limit = 3) {
  try {
    const feed = await parser.parseURL(url);
    const items = feed.items.slice(0, limit).map(item => ({
      source: sourceName,
      title: item.title?.trim() || '(senza titolo)',
      link: item.link?.trim() || ''
    })).filter(a => a.link);
    console.log(`✅ RSS ${sourceName}: ${items.length} articoli`);
    return items;
  } catch (e) {
    // Log dettagliato: distingue errore di rete da errore HTTP
    const status = e.response?.status || e.statusCode || 'N/A';
    console.error(`❌ Errore RSS ${sourceName} [HTTP ${status}]: ${e.message}`);
    return [];
  }
}

// --- Fonte Navigraph: AIRAC e novità dei programmi ---
// Il sito navigraph.com è renderizzato via JavaScript e non ha un feed leggibile,
// quindi si usa la ricerca RSS di simFlight, che pubblica ogni ciclo AIRAC
// e le novità di Navigraph. Si tengono solo i titoli che parlano di Navigraph/AIRAC
// e solo gli ultimi 14 giorni, per non rispolverare notizie vecchie.

async function getNavigraphNews() {
  const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
  try {
    const feed = await parser.parseURL('https://www.simflight.com/?s=navigraph&feed=rss2');
    const items = feed.items
      .filter(item => /navigraph|airac/i.test(item.title || ''))
      .filter(item => !item.isoDate || Date.now() - new Date(item.isoDate).getTime() <= MAX_AGE_MS)
      .slice(0, 3)
      .map(item => ({
        source: 'Navigraph',
        title: item.title.trim(),
        link: (item.link || '').trim()
      }))
      .filter(a => a.link);
    console.log(`✅ RSS Navigraph (simFlight): ${items.length} articoli`);
    return items;
  } catch (e) {
    console.error(`❌ Errore Navigraph [HTTP ${e.response?.status || e.statusCode || 'N/A'}]: ${e.message}`);
    return [];
  }
}

// --- Fonte scraping: flightsim.news ---

async function getFlightSimNews() {
  try {
    const { data } = await axios.get('https://flightsim.news/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlightSimNewsBot/1.0)' },
      timeout: 10000
    });
    const $ = cheerio.load(data);
    const articles = [];
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim();
      if (
        href && title && title.length > 10 &&
        /^https?:\/\/(?:www\.)?flightsim\.news\/[a-z0-9-]+\/?$/.test(href) &&
        !articles.find(a => a.link === href)
      ) {
        articles.push({ source: 'FlightSim News', title, link: href });
      }
      if (articles.length >= 3) return false;
    });
    console.log(`✅ Scraping FlightSim News: ${articles.length} articoli`);
    return articles;
  } catch (e) {
    console.error(`❌ Errore FlightSim News: ${e.message}`);
    return [];
  }
}

// --- Fonte scraping: DCS Official ---

async function getDcsNews() {
  try {
    const { data } = await axios.get('https://www.digitalcombatsimulator.com/en/news/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlightSimNewsBot/1.0)' },
      timeout: 10000
    });
    const $ = cheerio.load(data);
    const articles = [];
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim();
      const fullUrl = href && href.startsWith('/') ? `https://www.digitalcombatsimulator.com${href}` : href;
      if (
        fullUrl && title && title.length > 10 &&
        /^https?:\/\/www\.digitalcombatsimulator\.com\/en\/news\/.+/.test(fullUrl) &&
        !/\/changelog\//.test(fullUrl) &&
        !/\/news\/$/.test(fullUrl) &&
        !articles.find(a => a.link === fullUrl)
      ) {
        articles.push({ source: 'DCS Official', title, link: fullUrl });
      }
      if (articles.length >= 3) return false;
    });
    console.log(`✅ Scraping DCS Official: ${articles.length} articoli`);
    return articles;
  } catch (e) {
    console.error(`❌ Errore DCS News: ${e.message}`);
    return [];
  }
}

// --- Deduplicazione articoli ---

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl.trim());

    url.protocol = 'https:';
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    url.hash = '';

    // Elimina i parametri di tracciamento più comuni
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith('utm_') ||
        ['fbclid', 'gclid', 'mc_cid', 'mc_eid'].includes(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }

    url.searchParams.sort();

    return url.toString().replace(/\/$/, '');
  } catch {
    return rawUrl.trim().replace(/\/$/, '');
  }
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleWords(title) {
  const stopWords = new Set([
    'a', 'ad', 'al', 'alla', 'allo', 'ai', 'agli', 'alle',
    'anche', 'con', 'da', 'dal', 'dalla', 'de', 'del', 'della',
    'di', 'e', 'ed', 'il', 'in', 'la', 'le', 'lo', 'ma',
    'nel', 'nella', 'nei', 'non', 'per', 'su', 'tra', 'un',
    'una', 'uno', 'and', 'for', 'from', 'in', 'of', 'on',
    'the', 'to', 'with', 'new', 'news', 'update', 'available'
  ]);

  return new Set(
    normalizeTitle(title)
      .split(' ')
      .filter(word => word.length >= 3 && !stopWords.has(word))
  );
}

function areSimilarTitles(titleA, titleB) {
  const wordsA = titleWords(titleA);
  const wordsB = titleWords(titleB);

  if (wordsA.size === 0 || wordsB.size === 0) return false;

  const intersection = [...wordsA].filter(word => wordsB.has(word)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  const similarity = intersection / union;

  return similarity >= 0.75;
}

function deduplicateArticles(articles) {
  const unique = [];

  for (const article of articles) {
    const normalizedLink = normalizeUrl(article.link);

    const duplicate = unique.find(existing =>
      normalizeUrl(existing.link) === normalizedLink ||
      areSimilarTitles(existing.title, article.title)
    );

    if (!duplicate) {
      unique.push({
        ...article,
        link: normalizedLink
      });
    } else {
      console.log(
        `♻️ Duplicato scartato: "${article.title}" ` +
        `(già presente come "${duplicate.title}")`
      );
    }
  }

  return unique;
}

// --- Aggregatore principale ---

async function getNews() {
  const [flightSim, dcs, navigraph, fselite, msfsAddons, threshold, flightsimTo] = await Promise.all([
    getFlightSimNews(),
    getDcsNews(),
    getNavigraphNews(),
    getRssFeed('https://fselite.net/feed', 'FSElite'),
    getRssFeed('https://msfsaddons.com/feed', 'MSFS Addons'),
    getRssFeed('https://www.thresholdx.net/news/rss.xml', 'Threshold'),
    getRssFeed('https://news.flightsim.to/rss', 'FlightSim.to')
  ]);

  // DCS e Navigraph vengono per primi, così il tetto massimo non li taglia mai
  const all = [...dcs, ...navigraph, ...fselite, ...msfsAddons, ...threshold, ...flightsimTo, ...flightSim];

  const unique = deduplicateArticles(all);

  return unique.slice(0, MAX_ARTICLES);
}

// --- Data in italiano, ora di Roma: "Sabato 24 ottobre 2026" ---

function getItalianDate() {
  const options = {
    timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  };
  const text = new Date().toLocaleDateString('it-IT', options);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// --- Main ---

async function main() {
  const sentLinks = new Set(
    [...loadSentLinks()].map(normalizeUrl)
  );

  const allArticles = await getNews();
  const newArticles = allArticles.filter(a => !sentLinks.has(normalizeUrl(a.link)));
  console.log(`📰 Trovati ${allArticles.length} articoli totali, ${newArticles.length} nuovi (non ancora inviati).`);

  const italianDate = getItalianDate();

  if (newArticles.length === 0) {
    await sendTelegram(buildMessages([], italianDate));
    console.log('✅ Messaggio inviato (nessuna news nuova trovata)');
    return;
  }

  const analyses = await Promise.all(newArticles.map(analyzeArticle));
  const items = newArticles.map((a, i) => toItem(a, analyses[i]));

  await sendTelegram(buildMessages(items, italianDate));
  console.log(`✅ Inviati ${newArticles.length} articoli su Telegram!`);

  if (DRY_RUN) {
    console.log('🧪 DRY_RUN: sent_links.json non aggiornato.');
    return;
  }
  newArticles.forEach(a => sentLinks.add(normalizeUrl(a.link)));
  saveSentLinks(sentLinks);
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ Errore fatale:', err.message);
    process.exit(1);
  });
}
