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
    // Verifica che il token sia valido
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
    console.error(`   Token usato: ${token.substring(0, 10)}...`);
    console.error(`   Chat ID usato: ${chatId}`);
    process.exit(1);
  }
}

async function getNews() {
  try {
    const { data } = await axios.get('https://flightsim.news/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlightSimNewsBot/1.0)' }
    });
    const $ = cheerio.load(data);

    const articles = [];

    // I link degli articoli hanno il pattern /NUM/slug (es: /644/titolo-articolo)
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim();
      if (
        href &&
        title &&
        title.length > 10 &&
        /^https?:\/\/(?:www\.)?flightsim\.news\/\d+\//.test(href) &&
        !articles.find(a => a.link === href)
      ) {
        articles.push({ title, link: href });
      }
      if (articles.length >= 5) return false; // stop dopo 5
    });

    if (articles.length === 0) return '📰 Nessuna news trovata oggi';

    return articles
      .map((a, i) => `${i + 1}. <b>${a.title}</b>\n👉 ${a.link}`)
      .join('\n\n');

  } catch (e) {
    console.error('Errore scraping:', e.message);
    return '⚠️ Errore nel recupero delle notizie';
  }
}

async function main() {
  const news = await getNews();
  const date = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'Europe/Rome'
  });

  await sendTelegram(
    `✈️ <b>FlightSim News – ${date}</b>\n\n${news}`
  );
  console.log('✅ Messaggio Telegram inviato!');
}

main().catch(err => {
  console.error('❌ Errore:', err.message);
  process.exit(1);
});
