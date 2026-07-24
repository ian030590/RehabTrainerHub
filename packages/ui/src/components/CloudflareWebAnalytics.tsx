export interface CloudflareWebAnalyticsProps {
  token?: string;
}

const beaconUrl = 'https://static.cloudflareinsights.com/beacon.min.js';

export function CloudflareWebAnalytics({ token }: CloudflareWebAnalyticsProps) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) return null;

  return (
    <script
      data-cf-beacon={JSON.stringify({ token: normalizedToken })}
      defer
      src={beaconUrl}
    />
  );
}
