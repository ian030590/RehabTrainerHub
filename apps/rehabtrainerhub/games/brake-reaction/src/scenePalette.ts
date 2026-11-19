export const palette = {
  sky: '#0c1126', skyMiddle: '#1b2543', skyHorizon: '#65506c', star: '#f6eaff',
  horizonGlow: '255 177 114', city: '#fbd196',
  mountainFar: '#242a42', mountainNear: '#151d2c', mountainRim: '#666078',
  ground: '#151e22', groundNear: '#101718', shoulder: '#222b31',
  roadFar: '#414353', roadNear: '#292b37', wetFar: '#343b52', wetNear: '#202936',
  edgeYellow: '#e4b960', lane: '#e5e9f5', headlight: '255 222 174',
  median: '#353b4a', medianRim: '#676c7c', rail: '#667787', railRim: '#aebac6',
  reflectorPost: '#cbd7dd', reflector: '#ffbd55',
  pole: '#8192a8', lampCore: '#fff4d7', lampGlow: '255 204 132',
  hoodRim: '#697284', hoodNear: '#0b111b', hoodFar: '#303a4a',
  hoodReflection: '152 181 204', hoodWarm: '241 177 125',
  sedan: ['#b27b77', '#713e45', '#372b3c'], suv: ['#939bac', '#545f75', '#283348'],
  ev: ['#c0cbd5', '#788f9d', '#394b5d'], sport: ['#c1a35d', '#815e36', '#4b3931'],
  glass: ['#192439', '#4c5d76'], glassReflection: '185 216 241',
  shade: '#141724', tyre: '#10131c', seam: '#291f2c', plate: '#ece7d6', plateText: '#242738',
  tail: '#681825', brake: '#ff3b26', brakeCore: '#fff0ec', brakeGlow: '255 59 38',
  signal: '#ffb447', signalCore: '#fff3cd', signalGlow: '255 174 48',
  brokenLamp: '#271b24', scratch: '#d4cbd1', crease: '#252033',
  screenCrack: '#d0e0ec', smoke: '179 193 205', airbag: '#e2e3dc', airbagShadow: '#9da7b4',
  flash: '255 35 29', white: '255 251 242', debris: ['#bd3c41', '#cccdd7', '#687788'],
} as const;

export function Alpha(rgb: string, opacity: number) {
  return `rgb(${rgb} / ${opacity})`;
}

export function Bloom(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number,
  rgb: string, opacity: number, flatten = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, flatten);
  const light = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  light.addColorStop(0, Alpha(rgb, opacity));
  light.addColorStop(.32, Alpha(rgb, opacity * .58));
  light.addColorStop(1, Alpha(rgb, 0));
  ctx.fillStyle = light;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}
