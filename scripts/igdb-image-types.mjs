import "dotenv/config";

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;

const tokenRes = await fetch(
  `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
  { method: "POST" }
);
const { access_token } = await tokenRes.json();

const res = await fetch("https://api.igdb.com/v4/image_types", {
  method: "POST",
  headers: {
    "Client-ID": clientId,
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "text/plain",
  },
  body: "fields *; limit 50;",
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));