export const platformRuntimeContract = Object.freeze({
  jsPsychVersion: '8.2.3',
  gameSdkVersion: '0.1.0',
  jsPsychUrl: '/runtime/jspsych-8.2.3.js',
  jsPsychCssUrl: '/runtime/jspsych-8.2.3.css',
  gameSdkUrl: '/runtime/trainerhub-game-sdk-0.1.0.js',
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
