import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const url = process.argv[2];
const browser = await puppeteer.launch({
  headless: false, // ventana real
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  slowMo: 50,
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

// Cookies de Cloudflare y sesión
await page.setCookie(
  {
    name: 'cf_clearance',
    value: 'm5xdhTHvs3UUW0taaby7FOIatzxNWykf1DTIq3AdQlQ-1787016452-1.2.1.1-io37EbJHbX6_Q3cQXHpsjs1LN_De09KWkq85oROjp_S0WUxYd4okA0zJjm8uJG7lF9i9UjOie2XNQL9RUtSb40IHvl6W67KAh8MtI_Vx.lEdvtUwGcsVfaQgRjjoupb2TsuBtcnIHXapsEdEGwK_.zrxGf2ysgjweXDgU7i6rk6I_d.BdsNSdPjYlLXdpXrD_rEpFhyh3rYiZSmR72cIfdyEQeRVP9kDQGFeNfPeB9zEtWzFHrL0x9CypT9ucB.IxZCtf4NXgN3HHLqYpY6ux54FrKmbZDUMVJKCkvc85ZSL0ra.QYVweZd9kOy1A9bumFXeAARvqC0viDVf0M7sSrMSu8T.68968KCa8VAsX22FbKBGOODnfkZ2KJhjiUVwZi576V9VtYL7PZaP.pP0S7SO28Sjnj3EP1J2Q8JXFNeH9G_Yyua4advSMkQ2MjDD6UGUwQceRgLYc6UNho_SpkktmRA_Hu2fAQNCti7JN1jDku9es.kLFm7UjZxOutpU2Vz51aLW1RkrW2z99KnOwLPybO4GHx_2dVSW7Mx7v0TSnaEED8riWRkpKYBfx0pB',
    domain: '.albumoftheyear.org',
    path: '/',
  },
  {
    name: 'PHPSESSID',
    value: '2c96e7739be15218f331af9ac4f6ca7d',
    domain: '.albumoftheyear.org',
    path: '/',
  },
  {
    name: '__eoi',
    value: 'ID=bc323ccfe50b7279:T=1785055156:RT=1785519771:S=AA-AfjZB1K0DkO5PT8wnq6X9Ou49',
    domain: '.albumoftheyear.org',
    path: '/',
  },
  {
    name: '_ga',
    value: 'GA1.1.1552548970.1783800192',
    domain: '.albumoftheyear.org',
    path: '/',
  },
  {
    name: '_ga_C001HLCMMX',
    value: 'GS2.1.s1785519767$o3$g1$t1785520382$j60$l0$h0',
    domain: '.albumoftheyear.org',
    path: '/',
  },
  {
    name: '_ga_JB4RT8XZVE',
    value: 'GS2.1.s1785519767$o3$g1$t1785520382$j60$l0$h0',
    domain: '.albumoftheyear.org',
    path: '/',
  },
  {
    name: '_sharedid',
    value: '105d2a37-321e-44c9-a960-6806c35d5f3a',
    domain: '.albumoftheyear.org',
    path: '/',
  },
  {
    name: '_sharedid_cst',
    value: 'znv0HA%3D%3D',
    domain: '.albumoftheyear.org',
    path: '/',
  },
  {
    name: 'cto_bidid',
    value: 'H8sBS19qUjdmNHRhWTlvR3FoTmd0THdoZ0h3clpLcVd5QzF5S083JTJCWUxPJTJGcVhFaXFENlpYcHIlMkZETWlIbWpzQ0JqUk5TR08yNTVEJTJGdFBUTUJmR202MVFMalpOUWN2dmpFQXJqVFZFcEhPSldkZkJrcWFwejZWaVkyVnVFMktQMk9Rdmpq',
    domain: '.albumoftheyear.org',
    path: '/',
  },
  {
    name: 'cto_bundle',
    value: 'O1lIwV9NWGtGTWU1YU90cUVsTHd1R0tnb2Q3bXBiSEdVdkZjNGI5RkUzc1Juamp2TU5Id0o5JTJGOU43Wmxra1oyekFDOEZjYlRpTkklMkJWM2hNNkJ1aG9vV1lDJTJCbkpzTzUxS294emtxYXpkRUtvJTJGQ3BkQjJvc2ViZGVCeSUyRjl4eHp0JTJCdExXYkVOZWFITDEzYTdrTTR4JTJGUk1tRFcwd2lZd0JNNk5XOW9hbHZzaFpWVmdyQSUzRA',
    domain: '.albumoftheyear.org',
    path: '/',
  },
  {
    name: 'FCCDCF',
    value: '%5Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5B32%2C%22%5B%5C%22cbb0e062-ba33-4804-be72-a381f3d26050%5C%22%2C%5B1783800192%2C311000000%5D%5D%22%5D%5D%5D',
    domain: '.albumoftheyear.org',
    path: '/',
  },
  {
    name: 'FCNEC',
    value: '%5B%5B%22AKsRol8PdX_rTZrZ95rruizoOVpaRBqmC5JVXsYcBoPvauI10gxrZkKyylbhFPij6HtI-1NWCIA1yTLNuabqK24sOL5UgZheJt65qESeIHcYMIOKFwVujCyvYylEyuzgiHnYoCts4FbzSaTxNq5scER_ljDfOAcA5w%3D%3D%22%5D%5D',
    domain: '.albumoftheyear.org',
    path: '/',
  }
);

await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });

// Esperar un poco para que cargue todo
await new Promise(r => setTimeout(r, 5000));

const html = await page.content();
console.log('Título:', await page.title());
console.log('Contiene albumCriticScore:', html.includes('albumCriticScore'));
console.log('Contiene albumUserScore:', html.includes('albumUserScore'));

const scoreEls = await page.$$eval('[class*="score"]', els => els.map(el => el.className + ' | ' + el.textContent.trim().slice(0, 80)));
console.log('Elementos score:', scoreEls);

// Si aparecen los selectores, extraerlos
if (html.includes('albumCriticScore')) {
  const critic = await page.$eval('.albumCriticScore', el => el.textContent.trim());
  const user = await page.$eval('.albumUserScore', el => el.textContent.trim());
  console.log('Critic:', critic, 'User:', user);
}

await browser.close();