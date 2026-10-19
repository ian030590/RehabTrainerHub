// Frame names in sprites/driving-sprites.json, built by
// scripts/driving-pixel-sprites/build.mjs from CC0 kits (see sprites/SOURCES.md).

export const carModels = ['sedan', 'hatchback', 'suv', 'van'] as const;
export const vehicleColors = ['white', 'blue', 'red', 'amber', 'green', 'navy'] as const;
export const treeFrames = ['prop/tree-a', 'prop/tree-b', 'prop/tree-c'] as const;
export const facadeIds = [
  ...'abcdefghijklmn'.split(''),
  ...'abcde'.split('').map(letter => `skyscraper-${letter}`),
] as const;

export type CarModel = typeof carModels[number];
export type VehicleColor = typeof vehicleColors[number];
export type TrafficLampState = 'red' | 'yellow' | 'green';

export function CarSpriteName(model: CarModel | 'taxi', color: VehicleColor | 'taxi', view: number) {
  return `car/${model}/${color}/${view}`;
}

export function ScooterSpriteName(color: VehicleColor, view: number) {
  return `scooter/${color}/${view}`;
}

export function TrafficLightSpriteName(state: TrafficLampState) {
  return `prop/traffic-light/${state}`;
}

export function FacadeSpriteName(id: string, side: 'front' | 'side') {
  return `facade/${id}/${side}`;
}

const views = [0, 1, 2, 3, 4];

export const spriteFrameNames: readonly string[] = [
  ...carModels.flatMap(model => vehicleColors.flatMap(color => views.map(view => CarSpriteName(model, color, view)))),
  ...views.map(view => CarSpriteName('taxi', 'taxi', view)),
  ...vehicleColors.flatMap(color => views.map(view => ScooterSpriteName(color, view))),
  'player/rear',
  'prop/parked-scooter',
  'prop/street-light',
  'prop/utility-pole',
  ...treeFrames,
  ...(['red', 'yellow', 'green'] as const).map(TrafficLightSpriteName),
  ...facadeIds.flatMap(id => [FacadeSpriteName(id, 'front'), FacadeSpriteName(id, 'side')]),
  'skyline',
];
