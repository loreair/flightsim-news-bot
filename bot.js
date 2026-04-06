const axios = require('axios');
const cheerio = require('cheerio');

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(msg) {
  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId, 
    text: msg, 
    parse_mode: 'HTML'
  });
}

async function getNews() {
  try {
    const {data} = await axios.get('https://flightsim.news/');
    const $ = cheerio.load(data);
    const title = $('.latest-news h3 a').first().text().trim();
    const link = 'https://flightsim.news' + $('.latest-news h3 a').first().attr('href');
    return `${title}\n\n👉 ${link}`;
  } catch(e) {
    return '📰 Nessuna news trovata oggi';
  }
}

async function main() {
  const news = await getNews();
  await sendTelegram(`✈️ <b>FlightSim News Bot</b>\n\n${news}`);
  console.log('✅ Messaggio Telegram inviato!');
}

main().catch(console.error);
