import { gamePlatformRuntimeContract } from '@rehab-trainer/training-contracts';

export const platformRuntimeContract = Object.freeze({
  ...gamePlatformRuntimeContract,
  noticesUrl: '/runtime/THIRD_PARTY_NOTICES-0.1.0.txt',
  icon192Url: '/runtime/icons/trainerhub-192-v1.png',
  icon512Url: '/runtime/icons/trainerhub-512-v1.png',
});

export const platformRuntimePrecacheUrls = Object.freeze([
  platformRuntimeContract.jsPsychUrl,
  platformRuntimeContract.jsPsychCssUrl,
  platformRuntimeContract.gameSdkUrl,
  platformRuntimeContract.noticesUrl,
  platformRuntimeContract.icon192Url,
  platformRuntimeContract.icon512Url,
]);
