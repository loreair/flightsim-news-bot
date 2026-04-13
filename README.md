# ✈️ FlightSim News Bot — By LOREAIR

## Cos'è questo bot?

**FlightSim News Bot** è un bot Telegram automatico creato da **LOREAIR** per tutti gli appassionati di simulazione di volo.

Ogni 3 giorni, alle **ore 06:30 (ora italiana)**, il bot raccoglie e invia automaticamente le principali notizie dal mondo della simulazione di volo direttamente su Telegram, con un riassunto in italiano generato tramite intelligenza artificiale (Claude Haiku di Anthropic).

## A chi è rivolto?

Questo bot è pensato per:
- Appassionati di **DCS World** (Digital Combat Simulator)
- Appassionati di **Microsoft Flight Simulator (MSFS)**
- Piloti virtuali e fan di **X-Plane**
- Chiunque voglia restare aggiornato sul mondo dei **joystick, HOTAS, addon e aggiornamenti** dei principali simulatori di volo

## 📢 Canale Telegram

Le notizie vengono pubblicate sul canale Telegram ufficiale di LOREAIR.
Unisciti per ricevere le news ogni 3 giorni direttamente sul tuo smartphone!

## 📰 Fonti monitorate

Il bot aggrega notizie dalle seguenti fonti:

| Fonte | Tipo |
|---|---|
| [FlightSim News](https://flightsim.news) | Scraping |
| [DCS Official](https://www.digitalcombatsimulator.com/en/news/) | Scraping |
| [FSElite](https://fselite.net) | RSS |
| [MSFS Addons](https://msfsaddons.com) | RSS |
| [Threshold](https://www.thresholdx.net) | RSS |
| [FlightSim.to News](https://news.flightsim.to) | RSS |

## ⚙️ Come funziona

1. Il bot viene eseguito automaticamente tramite **GitHub Actions** ogni 3 giorni alle 06:30 ora italiana
2. Raccoglie le notizie più recenti da tutte le fonti
3. Filtra gli articoli già pubblicati in precedenza (nessuna ripetizione)
4. Genera un riassunto in italiano per ogni articolo tramite **Claude Haiku (Anthropic AI)**
5. Invia tutto sul canale Telegram con intestazione e firma I-LAIR

## 🎥 Video sulla simulazione di volo

Se sei appassionato di flight sim, puoi guardare i video di LOREAIR su YouTube: tutorial, recensioni, sessioni di volo su DCS e MSFS e molto altro!

👉 **[youtube.com/@LOREAIR](https://www.youtube.com/@LOREAIR)**

## 🛠️ Tecnologie utilizzate

- **Node.js** — runtime JavaScript
- **node-telegram-bot-api / axios** — invio messaggi Telegram
- **cheerio** — scraping HTML
- **rss-parser** — lettura feed RSS
- **@anthropic-ai/sdk** — riassunti AI in italiano
- **GitHub Actions** — scheduling e deployment automatico

---

*Happy Landings! ✈️*  
*I-LAIR — By bot loreair*
