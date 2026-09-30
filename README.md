# FlightSim News Bot

Bot Telegram che ogni sabato mattina pubblica le principali notizie dal mondo della simulazione di volo (MSFS, DCS, X-Plane), con un breve riassunto in italiano per ogni articolo.

Autore: I-LAIR (bot loreair)

## Come funziona

1. Raccoglie gli ultimi articoli da sei fonti (massimo 3 per fonte, massimo 15 in totale dopo la rimozione dei duplicati).
2. Scarta i link già inviati, memorizzati in `sent_links.json`.
3. Genera per ogni articolo nuovo un riassunto di 2 frasi in italiano con Claude Haiku 4.5.
4. Invia il messaggio su Telegram, dividendolo automaticamente in più parti se supera i 4000 caratteri.
5. Aggiorna `sent_links.json` (massimo 500 link) e lo salva nel repository.

Se non ci sono articoli nuovi, il bot invia comunque il messaggio di apertura con l'avviso "Nessuna novità".

## Pianificazione

Il bot viene eseguito da GitHub Actions **una sola volta a settimana, il sabato alle 07:00 (ora di Roma)**.

GitHub Actions usa l'orario UTC e non gestisce i fusi orari, quindi il workflow (`.github/workflows/news-bot.yml`) contiene due cron:

| Periodo | Cron (UTC) | Ora a Roma |
|---|---|---|
| Ora legale (CEST) | `0 5 * * 6` | 07:00 |
| Ora solare (CET) | `0 6 * * 6` | 07:00 |

Uno step iniziale controlla l'ora locale (`Europe/Rome`) e lascia proseguire il run solo se sono le 07. In questo modo l'invio resta alle 7:00 tutto l'anno, senza modifiche manuali al cambio dell'ora. Gli avvii manuali (`workflow_dispatch`) partono sempre.

Nota: GitHub può ritardare i run pianificati nei momenti di carico. Se il ritardo supera un'ora, l'invio della settimana viene saltato e va lanciato a mano da Actions.

## Messaggio di apertura

```
✈️ Buongiorno piloti e buon GG/MM/AAAA

Come ogni sabato mattina ecco le principali notizie dal mondo della simulazione di volo.
Buona lettura
Happy Landings
I-LAIR
( By bot loreair)
```

La data è calcolata in automatico sul fuso orario di Roma.

## Fonti

- FlightSim News (scraping)
- DCS Official (scraping)
- FSElite (RSS)
- MSFS Addons (RSS)
- Threshold (RSS)
- FlightSim.to (RSS)

## Configurazione

Nel repository vanno impostati questi segreti (Settings > Secrets and variables > Actions):

| Segreto | Descrizione |
|---|---|
| `TELEGRAM_TOKEN` | Token del bot, ottenuto da @BotFather |
| `TELEGRAM_CHAT_ID` | ID del canale o della chat di destinazione |
| `ANTHROPIC_API_KEY` | Chiave API Anthropic per i riassunti |

## Avvio manuale

Da GitHub: scheda **Actions**, workflow **FlightSim News Bot**, pulsante **Run workflow**. Il messaggio viene inviato subito su Telegram.

In locale (Node.js 24):

```bash
npm install cheerio axios rss-parser @anthropic-ai/sdk
TELEGRAM_TOKEN=... TELEGRAM_CHAT_ID=... ANTHROPIC_API_KEY=... node bot.js
```

## File del repository

- `bot.js`: logica del bot.
- `.github/workflows/news-bot.yml`: pianificazione ed esecuzione.
- `sent_links.json`: cache dei link già inviati, aggiornata dal workflow con un commit automatico (`[skip ci]`).
- `flightsim-news-bot_V2_0.html`: pagina HTML del progetto.
