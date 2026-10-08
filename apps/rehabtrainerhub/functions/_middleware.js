import officialGameReleases from '../../../packages/ui/src/officialGameReleases.json' with { type: 'json' };

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
  // Pages can retain deleted assets for a week; stop migrated assets before next() reads that cache.
  const gameAsset = url.pathname.match(/^\/games\/([^/]+)\/(.+)$/);
  if (gameAsset && Object.hasOwn(officialGameReleases, gameAsset[1]) && gameAsset[2] !== 'index.html') {
    return new Response(null, { status: 410, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } });
  }
  return next();
}

export { canonicalOrigin, canonicalRedirectHosts };
