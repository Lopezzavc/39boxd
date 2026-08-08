// scripts/generate-refraction-assets.js
// Ejecuta: node scripts/generate-refraction-assets.js
const fs = require("fs-extra");
const path = require("path");
const { PNG } = require("pngjs");
const crypto = require("crypto");

const outDir = path.resolve(__dirname, "../public/assets/refraction");
const manifestPath = path.resolve(__dirname, "../src/generated/refraction-manifest.json");

fs.ensureDirSync(outDir);

// Configura presets que quieres pre-generar (searchbox, player mobile/desktop, header si quieres)
const PRESETS = [
  {
    name: "searchbox",
    width: 320,
    height: 42,
    radius: 21,
    bezelWidth: 18,
    glassThickness: 100,
    refractiveIndex: 1.3,
    bezelType: "convex_squircle",
    maxDisplacement: 200,
  },
  {
    name: "player_mobile",
    width: 320,
    height: 54,
    radius: 27,
    bezelWidth: 29,
    glassThickness: 90,
    refractiveIndex: 1.3,
    bezelType: "convex_squircle",
    maxDisplacement: 220,
  },
  {
    name: "player_desktop",
    width: 640,
    height: 63,
    radius: 31,
    bezelWidth: 29,
    glassThickness: 90,
    refractiveIndex: 1.3,
    bezelType: "convex_squircle",
    maxDisplacement: 260,
  },
  {
    name: "header_small",
    width: 800,
    height: 64,
    radius: 32,
    bezelWidth: 32,
    glassThickness: 90,
    refractiveIndex: 1.35,
    bezelType: "convex_squircle",
    maxDisplacement: 220,
  },
];

function hashParams(params) {
  return crypto.createHash("sha1").update(JSON.stringify(params)).digest("hex").slice(0, 12);
}

// Simple noise function (value noise)
function noise2(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

// Generate a displacement map PNG: encode X->R, Y->G; center (no disp) = 128
function generateDisplacementPNG(w, h, maxDisp, params) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w) * 2 - 1;
      const ny = (y / h) * 2 - 1;
      // distance from center
      const r = Math.sqrt(nx * nx + ny * ny);
      // base radial displacement (bulge near center)
      const base = Math.max(0, 1 - r);
      // add small noise
      const n = (noise2(x * 0.13, y * 0.13) - 0.5) * 0.12;
      // displacement vector (dx,dy) in range -maxDisp..+maxDisp
      const dx = (nx * base * 1.0 + n * 0.06) * maxDisp;
      const dy = (ny * base * 0.6 + n * 0.06) * maxDisp;
      // encode where 0 -> 0, 128 -> no displacement; we map [-maxDisp..+maxDisp] -> [0..255]
      const rch = Math.round(128 + (dx / (maxDisp || 1)) * 127);
      const gch = Math.round(128 + (dy / (maxDisp || 1)) * 127);
      const bch = 128; // unused
      const idx = (w * y + x) << 2;
      png.data[idx] = clamp(rch, 0, 255);
      png.data[idx + 1] = clamp(gch, 0, 255);
      png.data[idx + 2] = bch;
      png.data[idx + 3] = 255;
    }
  }
  return png;
}

// Specular map: white highlight ring or rim; we create a radial specular map
function generateSpecularPNG(w, h, params) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w) * 2 - 1;
      const ny = (y / h) * 2 - 1;
      const r = Math.sqrt(nx * nx + ny * ny);
      // specular falloff: stronger at rim (for bezel highlight) and small center sheen
      const rim = Math.exp(-Math.max(0, (r - 0.6) * 10));
      const centerSheen = Math.exp(-r * 6);
      const val = clamp(
        Math.round(
          255 * Math.max(rim * 0.9, centerSheen * 0.6 + (noise2(x * 0.2, y * 0.2) - 0.5) * 0.05)
        ),
        0,
        255
      );
      const idx = (w * y + x) << 2;p
      png.data[idx] = val;
      png.data[idx + 1] = val;
      png.data[idx + 2] = val;
      png.data[idx + 3] = 255;
    }
  }
  return png;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

async function writePNG(png, filePath) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath);
    png.pack().pipe(stream).on("finish", resolve).on("error", reject);
  });
}

async function main() {
  const manifest = {};
  for (const preset of PRESETS) {
    const key = hashParams(preset);
    const dispName = `displacement-${preset.name}-${key}.png`;
    const specName = `specular-${preset.name}-${key}.png`;
    const dispPath = path.join(outDir, dispName);
    const specPath = path.join(outDir, specName);

    console.log("Generating preset:", preset.name, "->", dispName, specName);

    const disp = generateDisplacementPNG(preset.width, preset.height, preset.maxDisplacement, preset);
    const spec = generateSpecularPNG(preset.width, preset.height, preset);

    await writePNG(disp, dispPath);
    await writePNG(spec, specPath);

    manifest[key] = {
      name: preset.name,
      params: preset,
      displacement: `/assets/refraction/${dispName}`,
      specular: `/assets/refraction/${specName}`,
      maxDisplacement: preset.maxDisplacement,
    };
  }

  // Write manifest to src/generated so it can be imported by the app
  const generatedDir = path.resolve(__dirname, "../src/generated");
  fs.ensureDirSync(generatedDir);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  console.log("Refraction assets generated. Manifest written to", manifestPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});