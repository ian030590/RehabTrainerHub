import { ProcessGameReviewIssueJobs } from '../../apps/rehabtrainerhub/functions/_lib/gameReviewIssues.js';

export default {
  async scheduled(_controller, env, context) {
    context.waitUntil(ProcessGameReviewIssueJobs(env));
  },
};
