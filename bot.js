name: FlightSim News Bot

on:
  schedule:
    - cron: '30 5 * * *'  # 6:30 ora italiana (inverno/CET) | estate diventa 7:30, cambia in '30 4 * * *'
  workflow_dispatch:

jobs:
  send-news:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js 24
      uses: actions/setup-node@v4
      with:
        node-version: '24'
        
    - name: Install dependencies
      run: npm install cheerio axios
      
    - name: Run bot
      env:
        TELEGRAM_TOKEN: ${{ secrets.TELEGRAM_TOKEN }}
        TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
      run: node bot.js
