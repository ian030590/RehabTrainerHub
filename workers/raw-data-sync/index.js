import { ProcessRawDataSync } from '../../apps/rehabtrainerhub/functions/_lib/rawDataSync.js';

export default {
  async scheduled(_controller, env, context) {
    context.waitUntil(ProcessRawDataSync(env));
  },
};
