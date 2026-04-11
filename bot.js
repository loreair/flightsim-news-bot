const axios = require('axios');
const cheerio = require('cheerio');

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId) {
  console.error('❌ TELEGRAM_TOKEN o TELEGRAM_CHAT_ID mancanti!');
  process.exit(1);
}

async function sendTelegram(msg) {
  try {
    const me = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    console.log('✅ Bot valido:', me.data.result.username);
  } catch (e) {
    console.error('❌ TELEGRAM_TOKEN non valido:', e.response?.data || e.message);
    process.exit(1);
  }

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: msg,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });
  } catch (e) {
    console.error('❌ Errore sendMessage:', e.response?.data || e.message);
    process.exit(1);
  }
}

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
        href &&
        title &&
        title.length > 10 &&
        /^https?:\/\/(?:www\.)?flightsim\.news\/[a-z0-9-]+\/?$/.test(href) &&
        !articles.find(a => a.link === href)
      ) {
        articles.push({
          source: 'FlightSim News',
          title,
          link: href
        });
      }

      if (articles.length >= 5) return false;
    });

    return articles;
  } catch (e) {
    console.error('Errore FlightSim News:', e.message);
    return [];
  }
}

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

      const fullUrl =
        href && href.startsWith('/')
          ? `https://www.digitalcombatsimulator.com${href}`
          : href;

      if (
        fullUrl &&
        title &&
        title.length > 10 &&
        /^https?:\/\/www\.digitalcombatsimulator\.com\/en\/news\/.+/.test(fullUrl) &&
        !/\/changelog\//.test(fullUrl) &&
        !/\/news\/$/.test(fullUrl) &&
        !articles.find(a => a.link === fullUrl)
      ) {
        articles.push({
          source: 'DCS Official',
          title,
          link: fullUrl
        });
      }

      if (articles.length >= 5) return false;
    });

    return articles;
  } catch (e) {
    console.error('Errore DCS News:', e.message);
    return [];
  }
}

async function getNews() {
  const all = [
    ...(await getFlightSimNews()),
    ...(await getDcsNews())
  ];

  const unique = all.filter((article, index, self) =>
    index === self.findIndex(a => a.link === article.link)
  );

  return unique.slice(0, 10);
}

async function main() {
  const articles = await getNews();

  const date = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome'
  });

  const newsText = articles.length === 0
    ? '📰 Buongiorno piloti, purtroppo il Bot non ha trovato nessuna news oggi'
    : articles
        .map((a, i) => `${i + 1}. <b>[${a.source}] ${a.title}</b>\n👉 ${a.link}`)
        .join('\n\n');

  await sendTelegram(`✈️ <b>FlightSim News By LOREAIR – ${date}</b>\n\n${newsText}`);
  console.log('✅ Messaggio Telegram inviato!');
}

main().catch(err => {
  console.error('❌ Errore:', err.message);
  process.exit(1);
});
