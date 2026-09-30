# FlightSim News Bot

🇮🇹 [Italiano](README.md) | 🇬🇧 English

A Telegram bot that, every Saturday morning, posts the main news from the flight simulation world (MSFS, DCS, X-Plane), with a short summary in Italian for each article.

Author: I-LAIR (bot loreair)

## Follow me

- YouTube: [youtube.com/@LOREAIR](https://youtube.com/@LOREAIR)
- Twitch: [twitch.tv/loreair](https://www.twitch.tv/loreair)
- Instagram: [@loreair_aviation](https://www.instagram.com/loreair_aviation/)
- Discord: [discord.gg/37wpFTNbsy](https://discord.gg/37wpFTNbsy)
- Telegram (channel): [t.me/LoreairOfficial](https://t.me/LoreairOfficial)
- GitHub: [github.com/loreair](https://github.com/loreair)

## How it works

1. Collects the latest articles from six sources (up to 3 per source, up to 15 in total after removing duplicates).
2. Skips links that were already sent, stored in `sent_links.json`.
3. Generates a 2-sentence summary in Italian for each new article using Claude Haiku 4.5.
4. Sends the message to Telegram, automatically splitting it into several parts if it exceeds 4000 characters.
5. Updates `sent_links.json` (up to 500 links) and saves it in the repository.

If there are no new articles, the bot still sends the opening message with a "no news" notice.

## Schedule

The bot runs on GitHub Actions **once a week, on Saturday at 07:00 (Rome time)**.

GitHub Actions uses UTC and does not support time zones in cron, so the workflow (`.github/workflows/news-bot.yml`) contains two cron entries:

| Period | Cron (UTC) | Rome time |
|---|---|---|
| Daylight saving (CEST) | `0 5 * * 6` | 07:00 |
| Standard time (CET) | `0 6 * * 6` | 07:00 |

An initial step checks the local time (`Europe/Rome`) and lets the run continue only if it is 07 o'clock. This keeps the post at 7:00 all year round, with no manual changes when the clocks change. Manual runs (`workflow_dispatch`) always start.

Note: GitHub may delay scheduled runs during periods of high load. If the delay exceeds one hour, that week's post is skipped and must be started manually from Actions.

## Opening message

The message is posted in Italian:

```
✈️ Buongiorno piloti e buon DD/MM/YYYY

Come ogni sabato mattina ecco le principali notizie dal mondo della simulazione di volo.
Buona lettura
Happy Landings
I-LAIR
( By bot loreair)
```

In English: "Good morning pilots, and happy [date]. As every Saturday morning, here are the main news from the flight simulation world. Enjoy the read. Happy Landings." The date is calculated automatically using the Rome time zone.

## Sources

- FlightSim News (scraping)
- DCS Official (scraping)
- FSElite (RSS)
- MSFS Addons (RSS)
- Threshold (RSS)
- FlightSim.to (RSS)

## Configuration

These secrets must be set in the repository (Settings > Secrets and variables > Actions):

| Secret | Description |
|---|---|
| `TELEGRAM_TOKEN` | Bot token, obtained from @BotFather |
| `TELEGRAM_CHAT_ID` | ID of the destination channel or chat |
| `ANTHROPIC_API_KEY` | Anthropic API key used for the summaries |

## Manual run

From GitHub: **Actions** tab, **FlightSim News Bot** workflow, **Run workflow** button. The message is sent to Telegram immediately.

Locally (Node.js 24):

```bash
npm install cheerio axios rss-parser @anthropic-ai/sdk
TELEGRAM_TOKEN=... TELEGRAM_CHAT_ID=... ANTHROPIC_API_KEY=... node bot.js
```

## Repository files

- `bot.js`: bot logic.
- `.github/workflows/news-bot.yml`: scheduling and execution.
- `sent_links.json`: cache of links already sent, updated by the workflow with an automatic commit (`[skip ci]`).
- `flightsim-news-bot_V2_0.html`: project HTML page.
- `README.md`: Italian version of this document.
