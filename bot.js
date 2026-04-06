const cheerio = require('cheerio');
const axios = require('axios');
const https = require('https');

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(msg) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await axios.post(url, {chat_id: chatId, text: msg, parse_mode: 'HTML'});
}

async function scrapeNews(url, selector) {
  const {data} = await axios.get(url);
  const $ = cheerio.load(data);
  return $(selector).first().text().trim();
}

async function main() {
  try {
    const news = await scrapeNews('https://flightsim.to/', '.news-item-title');
    await sendTelegram(`📰 <b>FlightSim News</b>\n\n${news}`);
    console.log('✅ News inviate!');
  } catch(e) {
    console.error('❌ Errore:', e.message);
  }
}

main();
