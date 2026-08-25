const canonicalOrigin = 'https://trainerhub.cc';
const canonicalRedirectHosts = new Set([
  'rehabtrainerhub.pages.dev',
  'motor.trainerhub.cc',
  'vision.trainerhub.cc',
  'brain.trainerhub.cc',
  'mouth.trainerhub.cc',
  'motortrainer.pages.dev',
  'visiontrainer.pages.dev',
  'braintrainer.pages.dev',
  'mouthtrainer.pages.dev',
]);

export function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (canonicalRedirectHosts.has(url.hostname.toLowerCase())) {
    return Response.redirect(`${canonicalOrigin}/`, 301);
  }
  return next();
}

export { canonicalOrigin, canonicalRedirectHosts };
