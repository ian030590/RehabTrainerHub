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
  for (const projectName of app.retiredProjectNames) {
    if (projectName === app.projectName || pagesApps.some((candidate) => candidate.projectName === projectName)) {
      throw new Error(`Refusing to retire active Pages project: ${projectName}`);
    }
    if (dryRun) {
      console.log(`$ cloudflare pages project retire ${projectName}`);
      continue;
    }
    if (await ProjectExists(projectName)) {
      console.log(`Retiring Cloudflare Pages project ${projectName}...`);
      await ApiRequest('DELETE', `/pages/projects/${encodeURIComponent(projectName)}`);
    }
  }
}

for (const app of pagesApps) {
  const hostnames = app.usesBuiltInPagesDomain
    ? app.redirectHostnames
    : [app.hostname, ...app.redirectHostnames];
  if (app.usesBuiltInPagesDomain) console.log(`Skipping built-in Pages domain for ${app.projectName}: ${app.hostname}`);
  for (const hostname of hostnames) await EnsureDomain(app, hostname);
}

async function EnsureDomain(app, hostname) {
  if (dryRun) {
    console.log(`$ cloudflare pages domain ensure ${app.projectName} ${hostname}`);
    return;
  }
  let domain = await GetDomain(app, hostname);
  if (!domain) {
    console.log(`Adding ${hostname} to ${app.projectName}...`);
    domain = await Request(app, 'POST', '', { name: hostname });
  } else {
    console.log(`Pages domain exists: ${app.projectName} -> ${hostname} (${domain.status})`);
  }

  ReportDomainStatus(app, domain, hostname);
}

async function GetDomain(app, hostname) {
  const domains = await Request(app, 'GET');
  return domains.find((domain) => domain.name === hostname) ?? null;
}

function ReportDomainStatus(app, domain, hostname) {
  if (domain?.status === 'active') {
    console.log(`Pages domain active: ${app.projectName} -> ${hostname}`);
    return;
  }
  const details = domain?.error_message ? `: ${domain.error_message}` : '';
  console.warn(`⚠ Pages domain ${hostname} is ${domain?.status ?? 'pending'}${details}. Activation continues asynchronously; deployment will proceed.`);
}

async function Request(app, method, suffix = '', body) {
  return ApiRequest(method, `/pages/projects/${encodeURIComponent(app.projectName)}/domains${suffix}`, body);
}

async function ProjectExists(projectName) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (response.status === 404) return false;
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) throw new Error(`Unable to inspect Pages project ${projectName}.`);
  return true;
}

async function ApiRequest(method, path, body) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}${path}`;
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
    throw new Error(`Cloudflare Pages API failed for ${path}: ${details}`);
  }
  return payload?.result;
}
