export const SurfaceEquations = {
  convex_circle: (x: number) => Math.sqrt(1 - Math.pow(1 - x, 2)),
  convex_squircle: (x: number) => Math.pow(1 - Math.pow(1 - x, 4), 1 / 4),
  concave: (x: number) => 1 - Math.sqrt(1 - Math.pow(x, 2)),
  lip: (x: number) => {
    const convex = Math.pow(1 - Math.pow(1 - Math.min(x * 2, 1), 4), 1 / 4);
    const concave = 1 - Math.sqrt(1 - Math.pow(1 - x, 2)) + 0.1;
    const smootherstep = 6 * Math.pow(x, 5) - 15 * Math.pow(x, 4) + 10 * Math.pow(x, 3);
    return convex * (1 - smootherstep) + concave * smootherstep;
  },
} as const;

export type SurfaceType = keyof typeof SurfaceEquations;

export const SURFACE_TYPES: SurfaceType[] = ["convex_circle", "convex_squircle", "concave", "lip"];

export class Spring {
  value: number;
  target: number;
  velocity: number;
  stiffness: number;
  damping: number;

  constructor(value: number, stiffness = 300, damping = 20) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  setTarget(target: number) {
    this.target = target;
  }

  update(dt: number) {
    const force = (this.target - this.value) * this.stiffness;
    const dampingForce = this.velocity * this.damping;
    this.velocity += (force - dampingForce) * dt;
    this.value += this.velocity * dt;
    return this.value;
  }

  isSettled() {
    return Math.abs(this.target - this.value) < 0.001 && Math.abs(this.velocity) < 0.001;
  }

  reset(value: number) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }
}

export function updateSprings<T extends Record<string, Spring>>(springs: T, dt: number) {
  const values = {} as { [K in keyof T]: number };
  let allSettled = true;
  for (const key of Object.keys(springs) as (keyof T)[]) {
    values[key] = springs[key].update(dt);
    if (!springs[key].isSettled()) allSettled = false;
  }
  return { values, allSettled };
}

export function calculateDisplacementMap1D(
  glassThickness: number,
  bezelWidth: number,
  surfaceFn: (x: number) => number,
  refractiveIndex: number,
  samples = 128
) {
  const eta = 1 / refractiveIndex;
  function refract(normalX: number, normalY: number): [number, number] | null {
    const dot = normalY;
    const k = 1 - eta * eta * (1 - dot * dot);
    if (k < 0) return null;
    const kSqrt = Math.sqrt(k);
    return [-(eta * dot + kSqrt) * normalX, eta - (eta * dot + kSqrt) * normalY];
  }
  const result: number[] = [];
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    const y = surfaceFn(x);
    const dx = x < 1 ? 0.0001 : -0.0001;
    const y2 = surfaceFn(Math.max(0, Math.min(1, x + dx)));
    const derivative = (y2 - y) / dx;
    const magnitude = Math.sqrt(derivative * derivative + 1);
    const normal: [number, number] = [-derivative / magnitude, -1 / magnitude];
    const refracted = refract(normal[0], normal[1]);
    if (!refracted) {
      result.push(0);
    } else {
      const remainingHeightOnBezel = y * bezelWidth;
      const remainingHeight = remainingHeightOnBezel + glassThickness;
      result.push(refracted[0] * (remainingHeight / refracted[1]));
    }
  }
  return result;
}

export function calculateDisplacementMap2D(
  canvasWidth: number,
  canvasHeight: number,
  objectWidth: number,
  objectHeight: number,
  radius: number,
  bezelWidth: number,
  maximumDisplacement: number,
  precomputedMap: number[]
) {
  const imageData = new ImageData(canvasWidth, canvasHeight);
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = 128;
    imageData.data[i + 1] = 128;
    imageData.data[i + 2] = 0;
    imageData.data[i + 3] = 255;
  }
  const radiusSquared = radius * radius;
  const radiusPlusOneSquared = (radius + 1) * (radius + 1);
  const radiusMinusBezelSquared = Math.max(0, (radius - bezelWidth) * (radius - bezelWidth));
  const widthBetweenRadiuses = objectWidth - radius * 2;
  const heightBetweenRadiuses = objectHeight - radius * 2;
  const objectX = (canvasWidth - objectWidth) / 2;
  const objectY = (canvasHeight - objectHeight) / 2;

  for (let y1 = 0; y1 < objectHeight; y1++) {
    for (let x1 = 0; x1 < objectWidth; x1++) {
      const idx = ((objectY + y1) * canvasWidth + objectX + x1) * 4;
      const isOnLeftSide = x1 < radius;
      const isOnRightSide = x1 >= objectWidth - radius;
      const isOnTopSide = y1 < radius;
      const isOnBottomSide = y1 >= objectHeight - radius;
      const x = isOnLeftSide ? x1 - radius : isOnRightSide ? x1 - radius - widthBetweenRadiuses : 0;
      const y = isOnTopSide ? y1 - radius : isOnBottomSide ? y1 - radius - heightBetweenRadiuses : 0;
      const distanceToCenterSquared = x * x + y * y;
      const isInBezel = distanceToCenterSquared <= radiusPlusOneSquared && distanceToCenterSquared >= radiusMinusBezelSquared;
      if (isInBezel) {
        const opacity =
          distanceToCenterSquared < radiusSquared
            ? 1
            : 1 - (Math.sqrt(distanceToCenterSquared) - Math.sqrt(radiusSquared)) / (Math.sqrt(radiusPlusOneSquared) - Math.sqrt(radiusSquared));
        const distanceFromCenter = Math.sqrt(distanceToCenterSquared);
        const distanceFromSide = radius - distanceFromCenter;
        const cos = distanceFromCenter > 0 ? x / distanceFromCenter : 0;
        const sin = distanceFromCenter > 0 ? y / distanceFromCenter : 0;
        const bezelRatio = Math.max(0, Math.min(1, distanceFromSide / bezelWidth));
        const bezelIndex = Math.floor(bezelRatio * precomputedMap.length);
        const distance = precomputedMap[Math.max(0, Math.min(bezelIndex, precomputedMap.length - 1))] || 0;
        const dX = maximumDisplacement > 0 ? (-cos * distance) / maximumDisplacement : 0;
        const dY = maximumDisplacement > 0 ? (-sin * distance) / maximumDisplacement : 0;
        imageData.data[idx] = Math.max(0, Math.min(255, 128 + dX * 127 * opacity));
        imageData.data[idx + 1] = Math.max(0, Math.min(255, 128 + dY * 127 * opacity));
        imageData.data[idx + 2] = 0;
        imageData.data[idx + 3] = 255;
      }
    }
  }
  return imageData;
}

export function calculateSpecularHighlight(
  objectWidth: number,
  objectHeight: number,
  radius: number,
  bezelWidth: number,
  specularAngle = Math.PI / 3
) {
  const imageData = new ImageData(objectWidth, objectHeight);
  const specularVector: [number, number] = [Math.cos(specularAngle), Math.sin(specularAngle)];
  const specularThickness = 1.5;
  const radiusSquared = radius * radius;
  const radiusPlusOneSquared = (radius + 1) * (radius + 1);
  const radiusMinusSpecularSquared = Math.max(0, (radius - specularThickness) * (radius - specularThickness));
  const widthBetweenRadiuses = objectWidth - radius * 2;
  const heightBetweenRadiuses = objectHeight - radius * 2;

  for (let y1 = 0; y1 < objectHeight; y1++) {
    for (let x1 = 0; x1 < objectWidth; x1++) {
      const idx = (y1 * objectWidth + x1) * 4;
      const isOnLeftSide = x1 < radius;
      const isOnRightSide = x1 >= objectWidth - radius;
      const isOnTopSide = y1 < radius;
      const isOnBottomSide = y1 >= objectHeight - radius;
      const x = isOnLeftSide ? x1 - radius : isOnRightSide ? x1 - radius - widthBetweenRadiuses : 0;
      const y = isOnTopSide ? y1 - radius : isOnBottomSide ? y1 - radius - heightBetweenRadiuses : 0;
      const distanceToCenterSquared = x * x + y * y;
      const isNearEdge = distanceToCenterSquared <= radiusPlusOneSquared && distanceToCenterSquared >= radiusMinusSpecularSquared;
      if (isNearEdge) {
        const distanceFromCenter = Math.sqrt(distanceToCenterSquared);
        const distanceFromSide = radius - distanceFromCenter;
        const opacity =
          distanceToCenterSquared < radiusSquared
            ? 1
            : 1 - (distanceFromCenter - Math.sqrt(radiusSquared)) / (Math.sqrt(radiusPlusOneSquared) - Math.sqrt(radiusSquared));
        const cos = distanceFromCenter > 0 ? x / distanceFromCenter : 0;
        const sin = distanceFromCenter > 0 ? -y / distanceFromCenter : 0;
        const dotProduct = Math.abs(cos * specularVector[0] + sin * specularVector[1]);
        const edgeRatio = Math.max(0, Math.min(1, distanceFromSide / specularThickness));
        const sharpFalloff = Math.sqrt(1 - (1 - edgeRatio) * (1 - edgeRatio));
        const coefficient = dotProduct * sharpFalloff;
        const color = Math.min(255, 255 * coefficient);
        const finalOpacity = Math.min(255, color * coefficient * opacity);
        imageData.data[idx] = color;
        imageData.data[idx + 1] = color;
        imageData.data[idx + 2] = color;
        imageData.data[idx + 3] = finalOpacity;
      }
    }
  }
  return imageData;
}

export function imageDataToDataURL(imageData: ImageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

export function safeNumber(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function safeRefractiveIndex(value: unknown, fallback = 1.5): number {
  const n = safeNumber(value, fallback, 0.0001, 100);
  return n <= 0 ? fallback : n;
}

export function maxAbs(values: number[]): number {
  let max = 0;
  for (const v of values) {
    const a = Math.abs(v);
    if (Number.isFinite(a) && a > max) max = a;
  }
  return max;
}

export interface GlassMapParams {
  width: number;
  height: number;
  radius: number;
  bezelWidth: number;
  glassThickness: number;
  refractiveIndex: number;
  surfaceType: SurfaceType;
  specularAngle?: number;
}

export interface GlassMapResult {
  displacementDataURL: string;
  specularDataURL: string;
  maximumDisplacement: number;
}

const MAP_CACHE_LIMIT = 96;
const mapCache = new Map<string, GlassMapResult>();

function mapCacheKey(p: Required<GlassMapParams>): string {
  return [
    p.width,
    p.height,
    p.radius.toFixed(2),
    p.bezelWidth.toFixed(2),
    p.glassThickness.toFixed(2),
    p.refractiveIndex.toFixed(4),
    p.surfaceType,
    p.specularAngle.toFixed(4),
  ].join("|");
}

export function computeGlassMaps(params: GlassMapParams): GlassMapResult | null {
  if (typeof document === "undefined") return null;

  const width = Math.round(safeNumber(params.width, 0, 0, 20000));
  const height = Math.round(safeNumber(params.height, 0, 0, 20000));
  if (width <= 0 || height <= 0) return null;

  const radius = Math.max(0, Math.min(safeNumber(params.radius, 0, 0, 20000), width / 2, height / 2));
  const bezelWidth = Math.max(0, Math.min(safeNumber(params.bezelWidth, 0, 0, 5000), Math.max(radius, 0.0001)));
  const glassThickness = safeNumber(params.glassThickness, 1, 0, 5000);
  const refractiveIndex = safeRefractiveIndex(params.refractiveIndex, 1.5);
  const surfaceType: SurfaceType = SurfaceEquations[params.surfaceType] ? params.surfaceType : "convex_squircle";
  const specularAngle = safeNumber(params.specularAngle, Math.PI / 3, -Math.PI * 4, Math.PI * 4);

  const full: Required<GlassMapParams> = {
    width,
    height,
    radius,
    bezelWidth,
    glassThickness,
    refractiveIndex,
    surfaceType,
    specularAngle,
  };
  const key = mapCacheKey(full);
  const cached = mapCache.get(key);
  if (cached) return cached;

  const surfaceFn = SurfaceEquations[surfaceType];
  const precomputed = calculateDisplacementMap1D(glassThickness, bezelWidth, surfaceFn, refractiveIndex);
  const maximumDisplacement = maxAbs(precomputed) || 1;

  const displacementData = calculateDisplacementMap2D(width, height, width, height, radius, bezelWidth, maximumDisplacement, precomputed);
  const specularData = calculateSpecularHighlight(width, height, radius, bezelWidth, specularAngle);

  const result: GlassMapResult = {
    displacementDataURL: imageDataToDataURL(displacementData),
    specularDataURL: imageDataToDataURL(specularData),
    maximumDisplacement,
  };

  if (mapCache.size >= MAP_CACHE_LIMIT) {
    const oldestKey = mapCache.keys().next().value;
    if (oldestKey !== undefined) mapCache.delete(oldestKey);
  }
  mapCache.set(key, result);

  return result;
}

export function safeDisplacementScale(maximumDisplacement: number, refractionScale: number): number {
  const md = safeNumber(maximumDisplacement, 1, 0, 100000);
  const rs = safeNumber(refractionScale, 1, -1000, 1000);
  const scale = md * rs;
  return Number.isFinite(scale) ? scale : 0;
}