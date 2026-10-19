// Pages added these headers to every static asset response; Workers static assets do not.
// Values from _headers still win because they are only filled in when missing.
const pagesAssetDefaults = [
  ['Access-Control-Allow-Origin', '*'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Content-Type-Options', 'nosniff'],
];

// Runs Pages Functions compiled by `wrangler pages functions build` as a Worker. Only the
// ASSETS binding is wrapped, so responses built by Functions code keep their own headers.
export function CreatePagesCompatibleWorker(pagesWorker) {
  return {
    fetch(request, env, context) {
      return pagesWorker.fetch(request, { ...env, ASSETS: WrapAssetBinding(env.ASSETS) }, context);
    },
  };
}

function WrapAssetBinding(assets) {
  return {
    async fetch(input, init) {
      return WithPagesAssetDefaults(await assets.fetch(input, init));
    },
  };
}

function WithPagesAssetDefaults(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of pagesAssetDefaults) {
    if (!headers.has(name)) headers.set(name, value);
  }
  if (response.status === 404) headers.set('Cache-Control', 'no-store');
  // Workers answer html_handling redirects with 307; Pages used a permanent 308.
  const status = response.status === 307 ? 308 : response.status;
  return new Response(response.body, { status, headers });
}
