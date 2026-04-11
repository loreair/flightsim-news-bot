const axios = require('axios');
const cheerio = require('cheerio');
const RSSParser = require('rss-parser');
const Anthropic = require('@anthropic-ai/sdk');

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const parser = new RSSParser();

if (!token || !chatId) {
  console.error('❌ TELEGRAM_TOKEN o TELEGRAM_CHAT_ID mancanti!');
  process.exit(1);
}
if (!anthropicKey) {
  console.error('❌ ANTHROPIC_API_KEY mancante!');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: anthropicKey });
const TELEGRAM_MAX = 4000; // margine di sicurezza sotto i 4096

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

async function sendMessage(text) {
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });
  } catch (e) {
    console.error('❌ Errore sendMessage:', e.response?.data || e.message);
    process.exit(1);
  }
}

// Spezza il testo in chunk da max TELEGRAM_MAX caratteri, senza spezzare gli articoli
async function sendTelegram(header, articlesBlocks) {
  await verifyBot();

  let current = header;
  for (const block of articlesBlocks) {
    if ((current + '\n\n' + block).length > TELEGRAM_MAX) {
      await sendMessage(current);
      await new Promise(r => setTimeout(r, 500)); // piccola pausa tra messaggi
      current = block;
    } else {
      current += (current === header ? '\n\n' : '\n\n') + block;
    }
  }
  if (current.trim()) await sendMessage(current);
}

// --- Riassunto in italiano via Claude Haiku 4.5 ---

async function summarizeInItalian(title, link) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Sei un assistente per appassionati di simulazione di volo. Leggi il titolo di questo articolo e scrivi un riassunto in italiano di 2 frasi brevi e coinvolgenti, adatto a un canale Telegram di appassionati di flight sim (DCS, MSFS, X-Plane). Non aggiungere emoji. Rispondi SOLO con il testo del riassunto, nient'altro.

Titolo: ${title}
URL: ${link}`
      }]
    });
    return response.content[0].text.trim();
  } catch (e) {
    console.error(`Errore riassunto Claude per "${title}":`, e.message);
    return null;
  }
}

// --- Fonti RSS ---

async function getRssFeed(url, sourceName, limit = 3) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.slice(0, limit).map(item => ({
      source: sourceName,
      title: item.title?.trim() || '(senza titolo)',
      link: item.link?.trim() || ''
    })).filter(a => a.link);
  } catch (e) {
    console.error(`Errore RSS ${sourceName}:`, e.message);
    return [];
  }
}

// --- Fonte scraping: flightsim.news ---

async function getFlightSimNews() {
  try {
    const { data } = await axios.get('https://flightsim.news/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlightSimNewsBot/1.0)' }
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
    return articles;
  } catch (e) {
    console.error('Errore FlightSim News:', e.message);
    return [];
  }
}

// --- Fonte scraping: DCS Official ---

async function getDcsNews() {
  try {
    const { data } = await axios.get('https://www.digitalcombatsimulator.com/en/news/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlightSimNewsBot/1.0)' }
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
    return articles;
  } catch (e) {
    console.error('Errore DCS News:', e.message);
    return [];
  }
}

// --- Aggregatore principale ---

async function getNews() {
  const [flightSim, dcs, fselite, msfsAddons, threshold, flightsimTo] = await Promise.all([
    getFlightSimNews(),
    getDcsNews(),
    getRssFeed('https://fselite.net/feed', 'FSElite'),
    getRssFeed('https://msfsaddons.com/feed', 'MSFS Addons'),
    getRssFeed('https://www.thresholdx.net/news/rss.xml', 'Threshold'),
    getRssFeed('https://news.flightsim.to/rss', 'FlightSim.to')
  ]);

  const all = [...flightSim, ...dcs, ...fselite, ...msfsAddons, ...threshold, ...flightsimTo];

  const unique = all.filter((article, index, self) =>
    index === self.findIndex(a => a.link === article.link)
  );

  return unique.slice(0, 15);
}

// --- Main ---

async function main() {
  const articles = await getNews();

  const date = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'Europe/Rome'
  });

  const header = `✈️ <b>FlightSim News By LOREAIR – ${date}</b>`;

  if (articles.length === 0) {
    await verifyBot();
    await sendMessage(`${header}\n\n📰 Buongiorno piloti, purtroppo il Bot non ha trovato nessuna news oggi`);
    console.log('✅ Messaggio inviato (nessuna news trovata)');
    return;
  }

  // Genera riassunti in italiano in parallelo
  const summaries = await Promise.all(
    articles.map(a => summarizeInItalian(a.title, a.link))
  );

  // Costruisce un blocco per ogni articolo
  const blocks = articles.map((a, i) => {
    const summary = summaries[i] ? `\n<i>${summaries[i]}</i>` : '';
    return `${i + 1}. <b>[${a.source}] ${a.title}</b>${summary}\n👉 ${a.link}`;
  });

  await sendTelegram(header, blocks);
  console.log(`✅ Inviati ${articles.length} articoli su Telegram!`);
}

main().catch(err => {
  console.error('❌ Errore:', err.message);
  process.exit(1);
});
