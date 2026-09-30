# FlightSim News Bot

🇮🇹 Italiano | 🇬🇧 [English](README.en.md)

Bot Telegram che due volte a settimana (mercoledì e sabato mattina) pubblica le principali notizie dal mondo della simulazione di volo (MSFS, DCS, X-Plane), con un breve riassunto in italiano generato da Claude Haiku.

**Autore:** I-LAIR (bot loreair)

---

## Seguimi

- YouTube: [youtube.com/@LOREAIR](https://youtube.com/@LOREAIR)
- Twitch: [twitch.tv/loreair](https://www.twitch.tv/loreair)
- Instagram: [@loreair_aviation](https://www.instagram.com/loreair_aviation/)
- Discord: [discord.gg/37wpFTNbsy](https://discord.gg/37wpFTNbsy)
- Telegram (canale): [t.me/LoreairOfficial](https://t.me/LoreairOfficial)
- GitHub: [github.com/loreair](https://github.com/loreair)

---

## Come funziona

1. Raccoglie gli ultimi articoli da sei fonti (massimo 3 per fonte, massimo 15 in totale dopo la rimozione dei duplicati).
2. Scarta i link già inviati, memorizzati in `sent_links.json`.
3. Genera per ogni articolo nuovo un riassunto di 2 frasi in italiano con **Claude Haiku 4.5** (Anthropic).
4. Invia il messaggio su Telegram, dividendolo automaticamente in più parti se supera i 4000 caratteri.
5. Aggiorna `sent_links.json` (massimo 500 link) e lo salva nel repository tramite commit automatico.

Se non ci sono articoli nuovi, il bot invia comunque il messaggio di apertura con l'avviso "Nessuna novità".

---

## Pianificazione

Il bot viene eseguito da GitHub Actions **due volte a settimana: mercoledì e sabato alle 06:30 (ora di Roma)**.

GitHub Actions usa l'orario UTC e non gestisce i fusi orari. Il cron è impostato su `30 4 * * 3,6` (04:30 UTC = 06:30 CEST in ora legale).

> **Nota cambio ora:** In inverno (CET, UTC+1) aggiornare il cron in `30 5 * * 3,6` per mantenere le 06:30 ora di Roma.

| Giorno | Cron (UTC) | Ora a Roma (CEST) |
|---|---|---|
| Mercoledì | `30 4 * * 3` | 06:30 |
| Sabato | `30 4 * * 6` | 06:30 |

> GitHub può ritardare i run pianificati nei momenti di carico. Se il ritardo è eccessivo, il run va lanciato a mano da Actions.

---

## Messaggio di apertura

```
✈️ Buongiorno piloti e buon GG/MM/AAAA

Ecco le principali notizie dal mondo della simulazione di volo.
Buona lettura
Happy Landings
I-LAIR
( By bot loreair)
```

La data è calcolata automaticamente sul fuso orario di Roma.

---

## Fonti

| Fonte | Metodo |
|---|---|
| FlightSim News | Scraping |
| DCS Official | Scraping |
| FSElite | RSS |
| MSFS Addons | RSS |
| Threshold | RSS |
| FlightSim.to | RSS |

---

## Configurazione

Nel repository vanno impostati questi segreti (**Settings → Secrets and variables → Actions**):

| Segreto | Descrizione |
|---|---|
| `TELEGRAM_TOKEN` | Token del bot, ottenuto da @BotFather |
| `TELEGRAM_CHAT_ID` | ID del canale o della chat di destinazione |
| `ANTHROPIC_API_KEY` | Chiave API Anthropic per i riassunti |

---

## Avvio manuale

Da GitHub: scheda **Actions → FlightSim News Bot → Run workflow**. Il messaggio viene inviato subito su Telegram.

In locale (Node.js 24):

```bash
npm install cheerio axios rss-parser @anthropic-ai/sdk
TELEGRAM_TOKEN=... TELEGRAM_CHAT_ID=... ANTHROPIC_API_KEY=... node bot.js
```

---

## Stack tecnico

- **Runtime:** Node.js 24
- **AI:** Claude Haiku 4.5 via `@anthropic-ai/sdk`
- **Scraping / Feed:** `cheerio`, `axios`, `rss-parser`
- **Automazione:** GitHub Actions
- **Messaggistica:** Telegram Bot API

---

## File del repository

| File | Descrizione |
|---|---|
| `bot.js` | Logica principale del bot |
| `.github/workflows/news-bot.yml` | Pianificazione ed esecuzione (mercoledì e sabato 06:30 CEST) |
| `sent_links.json` | Cache dei link già inviati; aggiornata automaticamente con commit `[skip ci]` |
| `flightsim-news-bot_V2_0.html` | Pagina HTML descrittiva del progetto |
| `README.en.md` | Versione inglese di questo documento |
