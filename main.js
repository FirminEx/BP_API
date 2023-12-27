const axios = require('axios').default;
const sqlite = require('sqlite3').verbose();
const db = new sqlite.Database('api.sqlite', (err) =>
  err ? console.log('ERROR OPENING THE DB', err) : console.log('CONNECTED TO THE DB'),
);

const binanceApiUrl = 'https://testnet.binance.vision/api/v3';
const ASK = 'ask';
const BID = 'bid';
const directions = [ASK, BID];
const BTCUSDT = 'BTCUSDT';
const binanceCandleRefreshRate = 5000;

const getTradingPairs = async () => {
  const res = await axios.get(binanceApiUrl + '/exchangeInfo');
  return res.data.symbols.map(({ symbol }) => symbol);
};

const getDepth = async (symbol, direction = ASK) => {
  if (!directions.includes(direction)) throw Error('Invalid direction');
  const res = await axios.get(binanceApiUrl + '/depth', { params: { symbol, limit: 1 } });
  return direction === ASK ? res.data.asks[0] : res.data.bids[0];
};

const getOrderBook = async (symbol) => {
  const res = await axios.get(binanceApiUrl + '/depth', { params: { symbol } });
  return res.data;
};

const refreshDataCandle = async (symbol, interval = '1s', limit = 10) => {
  const latestStoredCandle = await getLatestCandleDate();
  const { data: latestFetchableCandle } = await axios.get(binanceApiUrl + '/klines', {
    params: { symbol, interval, limit: 1, timeZone: '+1' },
  });
  const latestFetchableCandleDate = latestFetchableCandle[0][0];

  console.log(`${latestStoredCandle} - ${latestFetchableCandleDate}`);

  if (latestStoredCandle < latestFetchableCandleDate) {
    console.log('INFO - Fetching recent candles');
    const { data: candles } = await axios.get(binanceApiUrl + '/klines', {
      params: { symbol, interval, limit, timeZone: '+1' },
    });
    await Promise.all(candles.map(candleArrayToObject).map(saveCandle));
    return candles;
  }

  console.log('INFO - Candle database already up to date');
};

const migrate = () =>
  new Promise((resolve, reject) =>
    db.run(
      `CREATE TABLE IF NOT EXISTS candles (Id INTEGER PRIMARY KEY, date INT, high REAL, low REAL, open REAL, close REAL, volume REAL)`,
      (err) => (err ? reject(err) : resolve(this)),
    ),
  );

const saveCandle = ({ date, high, low, open, close, volume }) =>
  new Promise((resolve, reject) =>
    db.run(
      `INSERT INTO candles(date, high, low, open, close, volume) VALUES (${date}, ${high}, ${low}, ${open}, ${close}, ${volume});`,
      (err, rows) => (err ? reject(err) : resolve(rows)),
    ),
  );

const getCandles = () =>
  new Promise((resolve, reject) =>
    db.all(`SELECT * FROM candles;`, [], (err, rows) => (err ? reject(err) : resolve(rows))),
  );

const candleArrayToObject = (candleArray) => ({
  date: candleArray[0],
  high: candleArray[2],
  low: candleArray[3],
  open: candleArray[1],
  close: candleArray[4],
  volume: [5],
});

const getLatestCandleDate = async () => {
  const { date } = await new Promise((resolve, reject) =>
    db.get(`SELECT date FROM candles ORDER BY date DESC;`, (err, rows) => (err ? reject(err) : resolve(rows))),
  );
  return date;
};

const createOrder = async (apiKey,  direction, price, amount, pair, orderType) => {
  const res = await axios.post(binanceApiUrl + '/order', { }, {headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY}});
  return res.data;
}

const main = async () => {
  await migrate();

  setInterval(refreshDataCandle, 5 * 60 * 1000);
};

main();
