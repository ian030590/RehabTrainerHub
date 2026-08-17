const restrictedPrefixes = [
  'AUTH_',
  'NEXT_PUBLIC_AUTH_',
  'VITE_AUTH_',
  'GOOGLE_',
  'TURNSTILE_',
  'NEXT_PUBLIC_TURNSTILE_',
  'VITE_TURNSTILE_',
  'CLOUDFLARE_',
];

const restrictedNames = new Set([
  'ASSET_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN',
  'VITE_AI_ASSET_BASE_URL',
  'VITE_CF_WEB_ANALYTICS_TOKEN',
]);

export function CreateGamehostBuildEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment).filter(([name]) => !IsRestrictedGamehostEnvironmentName(name)),
  );
}

export function CreateCloudflareDeploymentEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment).filter(([name]) => {
      const normalizedName = String(name).toUpperCase();
      if (normalizedName === 'CLOUDFLARE_API_TOKEN') return true;
      return !IsAuthEnvironmentName(normalizedName)
        && !/(?:^|_)(?:PASSWORD|PRIVATE_KEY|SECRET|TOKEN)(?:_|$)/.test(normalizedName);
    }),
  );
}

export function IsRestrictedGamehostEnvironmentName(name) {
  const normalizedName = String(name).toUpperCase();
  return restrictedNames.has(normalizedName)
    || restrictedPrefixes.some((prefix) => normalizedName.startsWith(prefix))
    || /(?:^|_)(?:PASSWORD|PRIVATE_KEY|SECRET|TOKEN)(?:_|$)/.test(normalizedName);
}

function IsAuthEnvironmentName(normalizedName) {
  return restrictedNames.has(normalizedName)
    || restrictedPrefixes
      .filter((prefix) => prefix !== 'CLOUDFLARE_')
      .some((prefix) => normalizedName.startsWith(prefix));
}
