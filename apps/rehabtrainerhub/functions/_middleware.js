const canonicalOrigin = 'https://trainerhub.cc';
const retiredTrainerHosts = new Set([
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
  if (retiredTrainerHosts.has(url.hostname.toLowerCase())) {
    return Response.redirect(`${canonicalOrigin}/`, 301);
  }
  return next();
}

export { canonicalOrigin, retiredTrainerHosts };
