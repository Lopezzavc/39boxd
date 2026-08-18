import "dotenv/config";

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;

const tokenRes = await fetch(
  `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
  { method: "POST" }
);
const { access_token } = await tokenRes.json();

const gameId = process.argv[2] || 1942;

const res = await fetch("https://api.igdb.com/v4/games", {
  method: "POST",
  headers: {
    "Client-ID": clientId,
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "text/plain",
  },
  body: `fields name, artworks.url, artworks.width, artworks.height, artworks.image_type,
    artworks.image_type.name, screenshots.url, screenshots.width, screenshots.height;
    where id = ${gameId};`,
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));