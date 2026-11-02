import * as collect from './pickups/collect-burst.js';
import * as movement from './impacts/hit-spark.js';
import * as complete from './ui/confetti.js';
export const effects = {
  collect: { meta: collect.meta, create: collect.Create },
  movement: { meta: movement.meta, create: movement.Create },
  complete: { meta: complete.meta, create: complete.Create },
};
