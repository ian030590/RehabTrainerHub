import { options, type Settings } from '../settings.js';
import { RandomFrom } from './round.js';

const decoyFrames = ['decoy-van', 'decoy-taxi', 'decoy-suv', 'decoy-delivery'] as const;

export function CarFrames(lead: Settings['leadType'], seed: number, decoyCount: number) {
  const random = RandomFrom(seed);
  const otherBodies = options.leadType.filter(body => body !== lead);
  const far = otherBodies[Math.floor(random() * otherBodies.length)];
  const decoys = Array.from({ length: decoyCount }, () => decoyFrames[Math.floor(random() * decoyFrames.length)]);
  return { lead, far, decoys };
}
