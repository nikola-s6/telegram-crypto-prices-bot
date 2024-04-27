import TelegramBot, { SendMessageOptions } from 'node-telegram-bot-api';
import cron from 'node-cron';
import axios from 'axios';
import 'dotenv/config';

const token = process.env.TELEGRAM_API_KEY;
const bot = new TelegramBot(token, { polling: true });

const activeMap = new Map<number, boolean>();

const keyboardOptions = {
  reply_markup: {
    keyboard: [
      [{ text: 'Avalanche' }, { text: 'Solana' }],
      [{ text: 'Bitcoin' }, { text: 'Ethereum' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
} satisfies SendMessageOptions;

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  activeMap.set(chatId, true);
  bot.sendMessage(
    chatId,
    'You have sucessfully subscribed to CryptoPriceFetch bot!'
  );
});

bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;
  activeMap.set(chatId, false);
  bot.sendMessage(
    chatId,
    'You have sucessfully unsubscribed from CryptoPriceFetch bot!'
  );
});

bot.onText(/\/avax/, async (msg) => {
  const resp = await getPrices(['avalanche']);
  bot.sendMessage(msg.chat.id, resp, { parse_mode: 'HTML' });
});

bot.onText(
  /\/price (avalanche|ethereum|solana|bitcoin)/,
  async (msg, match) => {
    const resp = await getPrices([match[1] as Chain]);
    bot.sendMessage(msg.chat.id, resp, { parse_mode: 'HTML' });
  }
);

bot.onText(/\/prices/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Please select chain:', keyboardOptions);
});

bot.on('message', async (msg) => {
  const text = msg.text.toLowerCase();
  if (['avalanche', 'solana', 'ethereum', 'bitcoin'].includes(text)) {
    const resp = await getPrices([text as Chain]);
    bot.sendMessage(msg.chat.id, resp, { parse_mode: 'HTML' });
  }
});

const job = cron.schedule('0 0 10-0 * * *', async () => {
  const data = await getPrices(['avalanche', 'solana', 'bitcoin', 'ethereum']);

  for (const [chatId, isActive] of activeMap.entries()) {
    if (!isActive) continue;
    bot.sendMessage(chatId, data, { parse_mode: 'HTML' });
  }
});

job.start();

async function getPrices(chains: Chain[]): Promise<string> {
  const response = await axios.get(
    'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest',
    {
      headers: {
        'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY,
      },
      params: {
        slug: chains.join(','),
      },
    }
  );

  const data: any[] = response.data.data;

  let message = '<u><b>Prices:</b></u>\n\n';
  for (const priceData of Object.values(data)) {
    const quote = priceData.quote.USD;
    const priceNum = Number(quote.price).toFixed(2);
    const change = Number(quote.percent_change_24h).toFixed(2);
    message += `<b>${priceData.symbol}:</b> ${priceNum} (24h change: ${change}%)\n`;
  }
  return message;
}

console.log('Bot started and cron scheduled');
bot.setMyCommands([
  {
    command: '/start',
    description: 'Subscribe to hourly prices notifications.',
  },
  { command: '/stop', description: 'Stop receiving price notifications.' },
  {
    command: '/prices',
    description: 'Chose from options which chain price you want to receive.',
  },
  {
    command: '/price',
    description:
      'Type chain name and receive price (avalanche, solana, bitcoin, ethereum).',
  },
]);

type Chain = 'avalanche' | 'ethereum' | 'solana' | 'bitcoin';
