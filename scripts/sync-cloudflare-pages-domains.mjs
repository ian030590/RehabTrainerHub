#!/usr/bin/env node
import { DiscoverPagesApps } from './pages-apps.mjs';

const dryRun = process.argv.includes('--dry-run');
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

if (!dryRun && (!accountId || !apiToken)) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required to sync Pages domains.');
}

const pagesApps = DiscoverPagesApps();
console.log(`Syncing canonical domains for ${pagesApps.length} discovered Cloudflare Pages project(s).`);
for (const app of pagesApps) {
  if (dryRun) {
    console.log(`$ cloudflare pages domain ensure ${app.projectName} ${app.hostname}`);
    continue;
  }

  let domain = await GetDomain(app);
  if (!domain) {
    console.log(`Adding ${app.hostname} to ${app.projectName}...`);
    domain = await Request(app, 'POST', '', { name: app.hostname });
  } else {
    console.log(`Canonical domain exists: ${app.projectName} -> ${app.hostname} (${domain.status})`);
  }

  ReportDomainStatus(app, domain);
}

async function GetDomain(app) {
  const domains = await Request(app, 'GET');
  return domains.find((domain) => domain.name === app.hostname) ?? null;
}

function ReportDomainStatus(app, domain) {
  if (domain?.status === 'active') {
    console.log(`Canonical domain active: ${app.projectName} -> ${app.hostname}`);
    return;
  }
  const details = domain?.error_message ? `: ${domain.error_message}` : '';
  console.warn(`⚠ Canonical domain ${app.hostname} is ${domain?.status ?? 'pending'}${details}. Activation continues asynchronously; deployment will proceed.`);
}

async function Request(app, method, suffix = '', body) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(app.projectName)}/domains${suffix}`;
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const details = payload?.errors?.map((error) => error.message).filter(Boolean).join('; ') || `${response.status} ${response.statusText}`;
    throw new Error(`Cloudflare Pages domain API failed for ${app.projectName}: ${details}`);
  }
  return payload?.result;
}
