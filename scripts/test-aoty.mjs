import { load } from 'cheerio';

const url = process.argv[2];
if (!url) {
  console.error('Uso: node scripts/test-aoty.mjs <url_album_aoty>');
  process.exit(1);
}

// Usamos el proxy de Jina AI para evitar Cloudflare
const proxyUrl = `https://r.jina.ai/${url}`;
const res = await fetch(proxyUrl, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
  redirect: 'follow',
});

if (!res.ok) {
  console.error('Error:', res.status, res.statusText);
  process.exit(1);
}

const html = await res.text();
const $ = load(html);

const critic = $('.albumCriticScore').first().text().trim();
const user = $('.albumUserScore').first().text().trim();

console.log({ critic, user });

// Si están vacíos, buscar cualquier clase con 'score'
if (!critic && !user) {
  $('[class*="score"]').each((i, el) => {
    console.log(`[${i}]`, $(el).attr('class'), '->', $(el).text().trim().slice(0, 50));
  });
}