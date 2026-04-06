const fetch = require('node-fetch');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const SIMULATORS = ['MSFS', 'XP', 'DCS', 'FALCON'];

async function fetchNews() {
  const topics = SIMULATORS.map(s => s === 'MSFS' ? 'Microsoft Flight Simulator 2024' : s === 'XP' ? 'X-Plane 12' : s === 'DCS' ? 'DCS World' : 'Falcon BMS').join(', ');
  
  const response
