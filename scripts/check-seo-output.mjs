#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DiscoverPagesApps, defaultRepoRoot } from './pages-apps.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const args = process.argv.slice(2);
const validateAll = args.includes('--all');
const failures = [];
const hubSiteUrl = 'https://trainerhub.cc/';

const apps = validateAll
  ? DiscoverPagesApps(defaultRepoRoot).filter((app) => app.role !== 'gamehost')
  : [DiscoverCurrentApp()];

for (const app of apps) {
  ValidateAppSeo(app, failures);
}

if (failures.length > 0) {
  throw new Error(`SEO output check failed:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`);
}

console.log(`SEO output check passed for ${apps.length} app${apps.length === 1 ? '' : 's'}.`);

function DiscoverCurrentApp() {
  const appDir = resolve(ReadArgument('--app') ?? process.cwd());
  const packagePath = join(appDir, 'package.json');

  if (!existsSync(packagePath)) {
    throw new Error(`Missing app package.json: ${packagePath}`);
  }

  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  const role = pkg.rehabTrainer?.role;
  if (!['hub', 'trainer'].includes(role)) {
    throw new Error(`${packagePath} must define rehabTrainer.role as hub or trainer.`);
  }

  return {
    appName: pkg.name,
    appDir,
    outputDir: ReadArgument('--output') ?? (role === 'hub' ? 'out' : 'dist'),
    role,
    siteUrl: NormalizeSiteUrl(pkg.homepage, packagePath),
  };
}

function ValidateAppSeo(app, appFailures) {
  const outputDir = resolve(app.appDir, app.outputDir);
  const label = app.appName ?? app.appDir;
  const siteUrl = `${NormalizeSiteUrl(app.siteUrl, label)}/`;

  if (!existsSync(outputDir)) {
    appFailures.push(`${label}: build output is missing: ${outputDir}`);
    return;
  }

  const robotsPath = join(outputDir, 'robots.txt');
  const sitemapPath = join(outputDir, 'sitemap.xml');
  const llmsPath = join(outputDir, 'llms.txt');
  const indexPath = join(outputDir, 'index.html');
  const notFoundPath = join(outputDir, '404.html');
  const robots = ReadUtf8File(robotsPath, label, appFailures);
  const sitemap = ReadUtf8File(sitemapPath, label, appFailures);
  const indexHtml = ReadUtf8File(indexPath, label, appFailures);

  if (robots !== null) ValidateRobots(robots, robotsPath, siteUrl, app.role, appFailures);
  const sitemapUrls = sitemap === null
    ? []
    : ValidateSitemap(sitemap, sitemapPath, siteUrl, app.role, appFailures);

  if (indexHtml !== null) {
    ValidateIndexableHtml(indexHtml, indexPath, siteUrl, appFailures, app.role === 'hub');
    ValidateJsonLd(indexHtml, indexPath, siteUrl, app.role, appFailures);
  }

  ValidateSitemapPages(sitemapUrls, outputDir, siteUrl, app.role, appFailures);
  ValidateNotFoundPage(notFoundPath, label, appFailures);

  if (app.role === 'hub') {
    if (indexHtml !== null && !/<h1\b[^>]*\bid=["']lobby-title["'][^>]*>[\s\S]*?訓練大廳[\s\S]*?<\/h1>/i.test(indexHtml)) {
      appFailures.push(`${indexPath}: Hub homepage must prerender its visible heading in Traditional Chinese.`);
    }
    if (indexHtml !== null && !/<h2\b[^>]*\bid=["']lobby-guide-title["'][^>]*>居家訓練網是什麼？<\/h2>/i.test(indexHtml)) {
      appFailures.push(`${indexPath}: Hub homepage must prerender its visible site definition.`);
    }
    const llms = ReadUtf8File(llmsPath, 'Hub llms.txt', appFailures);
    if (llms !== null) ValidateLlmsTxt(llms, llmsPath, siteUrl, appFailures);
    ValidateHubAbout(join(outputDir, 'about', 'index.html'), appFailures);
    ValidateHubQaPerson(join(outputDir, 'qa', 'index.html'), appFailures);
    ValidateHubPrivatePages(outputDir, sitemapUrls, appFailures);
  }
}

function ValidateLlmsTxt(source, file, siteUrl, appFailures) {
  if (/<html\b/i.test(source)) {
    appFailures.push(`${file}: llms.txt must be Markdown-flavored plain text, not HTML.`);
  }
  if (!/^# 居家訓練網\s*$/m.test(source)) {
    appFailures.push(`${file}: llms.txt must start with the canonical local brand name as its H1.`);
  }
  if (!/^> \S.+$/m.test(source)) {
    appFailures.push(`${file}: llms.txt must provide a concise blockquote summary.`);
  }
  if (!/not individualized assessment, diagnosis, medical orders, treatment/i.test(source)) {
    appFailures.push(`${file}: llms.txt must preserve the site's non-service boundary.`);
  }

  const urls = [...source.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1]);
  const expectedUrls = [
    siteUrl,
    `${siteUrl}about/`,
    `${siteUrl}qa/`,
    `${siteUrl}download/`,
    `${siteUrl}privacy/`,
    `${siteUrl}sitemap.xml`,
  ];
  if (!HaveSameValues(urls, expectedUrls)) {
    appFailures.push(`${file}: llms.txt must link only to canonical public discovery resources.`);
  }
  if (/\b(?:motor|vision|brain|mouth)\.trainerhub\.cc\b|104\.com/i.test(source)) {
    appFailures.push(`${file}: llms.txt contains a retired trainer domain or prohibited profile URL.`);
  }
}

function ValidateRobots(source, file, siteUrl, role, appFailures) {
  if (Buffer.byteLength(source, 'utf8') > 500 * 1024) {
    appFailures.push(`${file}: robots.txt exceeds Google's 500 KiB limit.`);
  }
  if (/<html\b/i.test(source)) {
    appFailures.push(`${file}: robots.txt contains HTML instead of plain-text directives.`);
  }

  const directives = source
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(':');
      return separator < 0
        ? { name: line.toLowerCase(), value: '' }
        : {
            name: line.slice(0, separator).trim().toLowerCase(),
            value: line.slice(separator + 1).trim(),
          };
    });

  if (!directives.some((directive) => directive.name === 'user-agent' && directive.value === '*')) {
    appFailures.push(`${file}: missing "User-agent: *".`);
  }
  if (!directives.some((directive) => directive.name === 'allow' && directive.value === '/')) {
    appFailures.push(`${file}: missing "Allow: /".`);
  }
  if (directives.some((directive) => directive.name === 'disallow' && directive.value === '/')) {
    appFailures.push(`${file}: blocks the entire site with "Disallow: /".`);
  }
  if (role === 'hub') {
    const apiDisallows = directives.filter((directive) => (
      directive.name === 'disallow' && directive.value === '/api/'
    ));
    if (apiDisallows.length !== 1) {
      appFailures.push(`${file}: Hub robots.txt must disallow only the non-page /api/ prefix once.`);
    }
    for (const route of ['/admin/', '/developer/', '/progress/', '/train/']) {
      if (directives.some((directive) => directive.name === 'disallow' && directive.value === route)) {
        appFailures.push(`${file}: ${route} must remain crawlable so its noindex directive can be read.`);
      }
    }
  }

  const sitemapDirectives = directives.filter((directive) => directive.name === 'sitemap');
  const expectedSitemapUrl = `${siteUrl}sitemap.xml`;
  if (sitemapDirectives.length !== 1 || sitemapDirectives[0].value !== expectedSitemapUrl) {
    appFailures.push(`${file}: Sitemap directive must be exactly ${expectedSitemapUrl}.`);
  }
}

function ValidateSitemap(source, file, siteUrl, role, appFailures) {
  if (/<(?:changefreq|priority)>/i.test(source)) {
    appFailures.push(`${file}: contains changefreq or priority, which Google ignores; omit them.`);
  }

  const sitemapEntries = ParseSitemapXml(source, file, appFailures);
  if (!sitemapEntries) return [];
  const urls = sitemapEntries.map((entry) => entry.url);
  if (urls.length === 0) {
    appFailures.push(`${file}: contains no <loc> URLs.`);
    return [];
  }
  if (new Set(urls).size !== urls.length) {
    appFailures.push(`${file}: contains duplicate URLs.`);
  }

  for (const value of urls) {
    let url;
    try {
      url = new URL(value);
    } catch {
      appFailures.push(`${file}: invalid absolute URL: ${value}`);
      continue;
    }
    if (url.protocol !== 'https:') {
      appFailures.push(`${file}: sitemap URL must use HTTPS: ${value}`);
    }
    if (url.origin !== new URL(siteUrl).origin) {
      appFailures.push(`${file}: sitemap URL belongs to another host: ${value}`);
    }
    if (url.search || url.hash) {
      appFailures.push(`${file}: sitemap URL must not contain a query or fragment: ${value}`);
    }
    if (!url.pathname.endsWith('/')) {
      appFailures.push(`${file}: sitemap URL must match the site's trailing-slash canonical: ${value}`);
    }
  }

  const expectedUrls = role === 'hub'
    ? ['', 'about/', 'qa/', 'privacy/', 'download/'].map((path) => `${siteUrl}${path}`)
    : [siteUrl];
  if (!HaveSameValues(urls, expectedUrls)) {
    appFailures.push(`${file}: expected only these canonical public URLs: ${expectedUrls.join(', ')}.`);
  }

  return urls;
}

function ParseSitemapXml(source, file, appFailures) {
  const trimmed = source.trim();
  const declaration = trimmed.match(
    /^<\?xml\s+version=["']1\.0["']\s+encoding=["']UTF-8["']\s*\?>/i,
  );
  if (!declaration) {
    appFailures.push(`${file}: missing an XML 1.0 UTF-8 declaration.`);
    return null;
  }

  const documentBody = trimmed.slice(declaration[0].length).trim();
  const urlset = documentBody.match(
    /^<urlset\s+xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']\s*>([\s\S]*)<\/urlset>$/i,
  );
  if (!urlset) {
    appFailures.push(`${file}: is not a complete sitemap urlset with the standard namespace.`);
    return null;
  }

  const entries = [];
  let remaining = urlset[1];
  while (remaining.trim()) {
    const entry = remaining.match(
      /^\s*<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?\s*<\/url>/i,
    );
    if (!entry) {
      appFailures.push(`${file}: contains malformed or unsupported XML inside <urlset>.`);
      return null;
    }

    const lastModified = entry[2]?.trim();
    if (lastModified && Number.isNaN(Date.parse(lastModified))) {
      appFailures.push(`${file}: contains an invalid <lastmod> value: ${lastModified}.`);
    }
    entries.push({
      url: DecodeXml(entry[1].trim()),
      lastModified: lastModified ?? null,
    });
    remaining = remaining.slice(entry[0].length);
  }

  return entries;
}

function ValidateSitemapPages(urls, outputDir, siteUrl, role, appFailures) {
  const titles = new Map();
  const descriptions = new Map();
  const headings = new Map();

  for (const value of urls) {
    let url;
    try {
      url = new URL(value);
    } catch {
      continue;
    }
    if (url.origin !== new URL(siteUrl).origin) continue;

    const relativePath = url.pathname === '/'
      ? 'index.html'
      : join(url.pathname.slice(1), 'index.html');
    const file = join(outputDir, relativePath);
    const html = ReadUtf8File(file, value, appFailures);
    if (html === null) continue;

    const result = ValidateIndexableHtml(html, file, value, appFailures, role === 'hub');
    RecordUniqueValue(titles, result.title, file, 'title', appFailures);
    RecordUniqueValue(descriptions, result.description, file, 'meta description', appFailures);
    if (role === 'hub') RecordUniqueValue(headings, result.heading, file, 'H1', appFailures);
  }
}

function ValidateIndexableHtml(html, file, canonicalUrl, appFailures, requireHeading = false) {
  if (!/^<!doctype html>/i.test(html.trimStart())) {
    appFailures.push(`${file}: missing HTML doctype.`);
  }

  const titles = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)]
    .map((match) => DecodeHtml(match[1].trim()));
  if (titles.length !== 1 || !titles[0]) {
    appFailures.push(`${file}: must contain exactly one non-empty <title>.`);
  }

  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((match) => DecodeHtml(match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()));
  if (requireHeading && (headings.length !== 1 || !headings[0])) {
    appFailures.push(`${file}: must contain exactly one non-empty visible H1.`);
  }

  const description = FindMetaContent(html, 'name', 'description');
  if (!description) appFailures.push(`${file}: missing a non-empty meta description.`);

  const canonicalLinks = CollectTags(html, 'link')
    .filter((tag) => ReadAttributes(tag).rel?.toLowerCase().split(/\s+/).includes('canonical'))
    .map((tag) => ReadAttributes(tag).href);
  if (canonicalLinks.length !== 1 || canonicalLinks[0] !== canonicalUrl) {
    appFailures.push(`${file}: canonical must be exactly ${canonicalUrl}.`);
  }

  const robots = FindMetaContent(html, 'name', 'robots');
  if (!robots || !/\bindex\b/i.test(robots) || !/\bfollow\b/i.test(robots) || /\bnoindex\b/i.test(robots)) {
    appFailures.push(`${file}: public canonical page must declare index, follow.`);
  }

  const expectedSocialTags = [
    ['property', 'og:title'],
    ['property', 'og:description'],
    ['property', 'og:url'],
    ['property', 'og:image'],
    ['name', 'twitter:card'],
    ['name', 'twitter:title'],
    ['name', 'twitter:description'],
    ['name', 'twitter:image'],
  ];
  for (const [attribute, name] of expectedSocialTags) {
    const value = FindMetaContent(html, attribute, name);
    if (!value) appFailures.push(`${file}: missing ${name} metadata.`);
  }

  const ogUrl = FindMetaContent(html, 'property', 'og:url');
  if (ogUrl && ogUrl !== canonicalUrl) {
    appFailures.push(`${file}: og:url must match its canonical URL ${canonicalUrl}.`);
  }
  const pageTitle = titles[0] ?? '';
  for (const [attribute, name] of [['property', 'og:title'], ['name', 'twitter:title']]) {
    const value = FindMetaContent(html, attribute, name);
    if (value && value !== pageTitle) {
      appFailures.push(`${file}: ${name} must match the document title.`);
    }
  }
  for (const [attribute, name] of [['property', 'og:description'], ['name', 'twitter:description']]) {
    const value = FindMetaContent(html, attribute, name);
    if (value && value !== description) {
      appFailures.push(`${file}: ${name} must match the meta description.`);
    }
  }
  for (const name of ['og:image', 'twitter:image']) {
    const attribute = name.startsWith('og:') ? 'property' : 'name';
    const value = FindMetaContent(html, attribute, name);
    if (value && !IsAbsoluteHttpsUrl(value)) {
      appFailures.push(`${file}: ${name} must be an absolute HTTPS URL.`);
    }
  }

  return { title: pageTitle, description: description ?? '', heading: headings[0] ?? '' };
}

function ValidateJsonLd(html, file, siteUrl, role, appFailures) {
  const nodes = ParseJsonLdNodes(html, file, appFailures);
  if (!nodes) return;
  const applicationUrls = [role === 'hub' ? hubSiteUrl : siteUrl];
  const applicationIds = applicationUrls.map((url) => `${url}#application`);
  for (const applicationUrl of applicationUrls) {
    const applicationId = `${applicationUrl}#application`;
    const applications = nodes.filter((node) => (
      node?.['@id'] === applicationId && HasType(node, 'WebApplication')
    ));
    if (applications.length !== 1) {
      appFailures.push(`${file}: expected exactly one WebApplication JSON-LD node with @id ${applicationId}.`);
      continue;
    }
    ValidateWebApplication(
      applications[0],
      applicationUrl,
      applicationUrl === siteUrl ? FindMetaContent(html, 'name', 'description') : null,
      file,
      appFailures,
    );
  }

  if (role === 'hub') {
    const expectedHomepageNodes = new Map([
      [`${siteUrl}#website`, 'WebSite'],
      [`${siteUrl}#organization`, 'Organization'],
      [`${siteUrl}#application`, 'WebApplication'],
      [`${siteUrl}#faq`, 'FAQPage'],
    ]);
    const unexpectedHomepageNodes = nodes.filter((node) => {
      if (!node?.['@type']) return false;
      const expectedType = expectedHomepageNodes.get(node?.['@id']);
      const types = Array.isArray(node?.['@type']) ? node['@type'] : [node['@type']];
      return !expectedType || types.length !== 1 || types[0] !== expectedType;
    });
    if (unexpectedHomepageNodes.length > 0) {
      appFailures.push(`${file}: Hub homepage JSON-LD contains an unsupported top-level node.`);
    }
    const website = nodes.find((node) => node?.['@id'] === `${siteUrl}#website` && HasType(node, 'WebSite'));
    const organization = nodes.find((node) => node?.['@id'] === `${siteUrl}#organization` && HasType(node, 'Organization'));
    if (!website) appFailures.push(`${file}: missing the canonical WebSite JSON-LD node.`);
    if (!organization) appFailures.push(`${file}: missing the canonical Organization JSON-LD node.`);
    if (website) {
      if (website.publisher?.['@id'] !== `${siteUrl}#organization`) {
        appFailures.push(`${file}: WebSite.publisher must reference the canonical Organization @id.`);
      }
      if (!HaveSameValues(GetReferenceIds(website.hasPart), applicationIds)) {
        appFailures.push(`${file}: WebSite.hasPart must reference only the canonical Hub application.`);
      }
    }

    const hubApplication = nodes.find((node) => node?.['@id'] === `${siteUrl}#application`);
    if (hubApplication && GetReferenceIds(hubApplication.hasPart).length > 0) {
      appFailures.push(`${file}: Hub WebApplication must not reference retired trainer websites.`);
    }
    if (organization) {
      const sameAs = Array.isArray(organization.sameAs) ? organization.sameAs : [];
      if (!sameAs.includes('https://github.com/ian030590/RehabTrainerHub')) {
        appFailures.push(`${file}: Organization.sameAs must identify the visible official GitHub repository.`);
      }
      if (organization.contactPoint?.url !== 'https://github.com/ian030590/RehabTrainerHub/issues') {
        appFailures.push(`${file}: Organization.contactPoint must match the visible public issue-reporting channel.`);
      }
    }
    ValidateHomepageFaq(
      nodes.find((node) => node?.['@id'] === `${siteUrl}#faq` && HasType(node, 'FAQPage')),
      html,
      file,
      appFailures,
    );
  }
}

function ValidateHomepageFaq(faq, html, file, appFailures) {
  if (!faq) {
    appFailures.push(`${file}: missing the canonical homepage FAQPage JSON-LD node.`);
    return;
  }
  if (!Array.isArray(faq.mainEntity) || faq.mainEntity.length < 5) {
    appFailures.push(`${file}: FAQPage must include the visible homepage questions.`);
    return;
  }

  const visibleText = GetVisibleText(html);
  for (const question of faq.mainEntity) {
    const answer = question?.acceptedAnswer?.text;
    if (!HasType(question, 'Question') || !HasType(question?.acceptedAnswer, 'Answer')) {
      appFailures.push(`${file}: FAQPage entries must use Question and Answer types.`);
      continue;
    }
    for (const value of [question.name, answer]) {
      if (typeof value !== 'string' || !value.trim() || !visibleText.includes(value)) {
        appFailures.push(`${file}: FAQPage text must be non-empty and match visible homepage content.`);
      }
    }
  }
}

function ValidateHubAbout(file, appFailures) {
  const html = ReadUtf8File(file, 'Hub About page', appFailures);
  if (html === null) return;
  const visibleText = GetVisibleText(html);
  for (const text of ['關於居家訓練網', '不提供醫療服務', '內容責任', 'GitHub']) {
    if (!visibleText.includes(text)) {
      appFailures.push(`${file}: About page is missing visible trust content: ${text}.`);
    }
  }
  for (const url of [
    'https://github.com/ian030590/RehabTrainerHub',
    'https://github.com/ian030590/RehabTrainerHub/issues',
  ]) {
    if (!html.includes(`href="${url}"`)) {
      appFailures.push(`${file}: About page must link to ${url}.`);
    }
  }
}

function ValidateHubQaPerson(file, appFailures) {
  const html = ReadUtf8File(file, 'Hub QA page', appFailures);
  if (html === null) return;
  const nodes = ParseJsonLdNodes(html, file, appFailures);
  if (!nodes) return;

  const personId = `${hubSiteUrl}qa/#professional-background`;
  const people = nodes.filter((node) => node?.['@id'] === personId && HasType(node, 'Person'));
  if (people.length !== 1) {
    appFailures.push(`${file}: expected exactly one Person JSON-LD node with @id ${personId}.`);
    return;
  }

  const person = people[0];
  if (person.url !== personId) {
    appFailures.push(`${file}: Person.url must match the visible professional background anchor.`);
  }
  for (const property of ['name', 'jobTitle', 'description']) {
    if (typeof person[property] !== 'string' || !person[property].trim()) {
      appFailures.push(`${file}: Person.${property} must be non-empty.`);
    }
  }

  const visibleText = GetVisibleText(html);
  for (const property of ['name', 'jobTitle', 'description']) {
    if (person[property] && !visibleText.includes(person[property])) {
      appFailures.push(`${file}: Person.${property} must match visible QA page content.`);
    }
  }
}

function ParseJsonLdNodes(html, file, appFailures) {
  const values = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = ReadAttributes(match[1]);
    if (attributes.type?.toLowerCase() !== 'application/ld+json') continue;
    try {
      values.push(JSON.parse(match[2].trim()));
    } catch (error) {
      appFailures.push(`${file}: contains invalid JSON-LD (${error.message}).`);
    }
  }
  if (values.length === 0) {
    appFailures.push(`${file}: missing JSON-LD structured data.`);
    return null;
  }
  return values.flatMap(FlattenJsonLd);
}

function ValidateWebApplication(application, expectedUrl, pageDescription, file, appFailures) {
  const requiredTextProperties = ['name', 'description', 'applicationCategory', 'operatingSystem'];
  for (const property of requiredTextProperties) {
    if (typeof application[property] !== 'string' || !application[property].trim()) {
      appFailures.push(`${file}: WebApplication.${property} must be non-empty.`);
    }
  }
  if (application.url !== expectedUrl) {
    appFailures.push(`${file}: WebApplication.url must be ${expectedUrl}.`);
  }
  if (pageDescription && application.description !== pageDescription) {
    appFailures.push(`${file}: the canonical WebApplication description must match the page metadata.`);
  }
  if (application.applicationCategory !== 'EducationalApplication') {
    appFailures.push(`${file}: WebApplication.applicationCategory must be EducationalApplication.`);
  }
  const imageUrl = typeof application.image === 'string'
    ? application.image
    : application.image?.url;
  if (!IsAbsoluteHttpsUrl(imageUrl)) {
    appFailures.push(`${file}: WebApplication.image must be an absolute HTTPS URL.`);
  }
  if (application.isAccessibleForFree !== true || Number(application.offers?.price) !== 0) {
    appFailures.push(`${file}: WebApplication must accurately declare free access and an offer price of 0.`);
  }
  if (!Array.isArray(application.featureList) || application.featureList.length === 0) {
    appFailures.push(`${file}: WebApplication.featureList must describe visible app features.`);
  }
  if (application.isPartOf?.['@id'] !== `${hubSiteUrl}#website`) {
    appFailures.push(`${file}: WebApplication.isPartOf must reference the Hub WebSite @id.`);
  }
  if (application.publisher?.['@id'] !== `${hubSiteUrl}#organization`) {
    appFailures.push(`${file}: WebApplication.publisher must reference the Hub Organization @id.`);
  }
}

function GetReferenceIds(value) {
  const references = Array.isArray(value) ? value : value ? [value] : [];
  return references.map((reference) => reference?.['@id']).filter(Boolean);
}

function ValidateHubPrivatePages(outputDir, sitemapUrls, appFailures) {
  for (const route of ['admin/', 'developer/', 'progress/', 'train/']) {
    const publicUrlSuffix = `/${route}`;
    if (sitemapUrls.some((value) => new URL(value).pathname === publicUrlSuffix)) {
      appFailures.push(`${join(outputDir, 'sitemap.xml')}: private route ${publicUrlSuffix} must not be listed.`);
    }

    const file = join(outputDir, route, 'index.html');
    const html = ReadUtf8File(file, route, appFailures);
    if (html === null) continue;
    const robots = FindMetaContent(html, 'name', 'robots');
    if (!robots || !/\bnoindex\b/i.test(robots)) {
      appFailures.push(`${file}: private route must declare noindex.`);
    }
  }
}

function ValidateNotFoundPage(file, label, appFailures) {
  const html = ReadUtf8File(file, label, appFailures);
  if (html === null) return;
  const robotsValues = FindMetaContents(html, 'name', 'robots');
  if (robotsValues.length === 0 || robotsValues.some((value) => !/\bnoindex\b/i.test(value))) {
    appFailures.push(`${file}: custom 404 page must declare noindex.`);
  }
  const canonicalLinks = CollectTags(html, 'link')
    .filter((tag) => ReadAttributes(tag).rel?.toLowerCase().split(/\s+/).includes('canonical'));
  if (canonicalLinks.length > 0) {
    appFailures.push(`${file}: a not-found page must not canonicalize to unrelated content.`);
  }
}

function ReadUtf8File(file, label, appFailures) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    appFailures.push(`${label}: required SEO file is missing: ${file}`);
    return null;
  }
  const source = readFileSync(file).toString('utf8').replace(/^\uFEFF/, '');
  if (source.includes('\uFFFD')) {
    appFailures.push(`${file}: contains invalid UTF-8 data.`);
  }
  return source;
}

function GetVisibleText(html) {
  return DecodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function FindMetaContent(html, attributeName, attributeValue) {
  const matches = FindMetaContents(html, attributeName, attributeValue);
  return matches.length === 1 ? matches[0] : null;
}

function FindMetaContents(html, attributeName, attributeValue) {
  return CollectTags(html, 'meta')
    .map(ReadAttributes)
    .filter((attributes) => attributes[attributeName]?.toLowerCase() === attributeValue.toLowerCase())
    .map((attributes) => attributes.content?.trim())
    .filter(Boolean);
}

function CollectTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map((match) => match[0]);
}

function ReadAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributes[match[1].toLowerCase()] = DecodeHtml(match[2] ?? match[3] ?? '');
  }
  return attributes;
}

function FlattenJsonLd(value) {
  if (Array.isArray(value)) return value.flatMap(FlattenJsonLd);
  if (!value || typeof value !== 'object') return [];
  return [value, ...(Array.isArray(value['@graph']) ? value['@graph'].flatMap(FlattenJsonLd) : [])];
}

function HasType(node, expected) {
  const types = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
  return types.includes(expected);
}

function RecordUniqueValue(values, value, file, label, appFailures) {
  if (!value) return;
  if (values.has(value)) {
    appFailures.push(`${file}: duplicate ${label} also used by ${values.get(value)}.`);
    return;
  }
  values.set(value, file);
}

function ReadArgument(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function NormalizeSiteUrl(value, label) {
  const url = new URL(String(value).trim());
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${label}: homepage must be an HTTPS origin without a path, query, or hash.`);
  }
  return url.origin;
}

function IsAbsoluteHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function HaveSameValues(left, right) {
  return left.length === right.length
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && left.every((value) => right.includes(value));
}

function DecodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function DecodeHtml(value) {
  return DecodeXml(value)
    .replaceAll('&#x2F;', '/')
    .replaceAll('&#47;', '/')
    .replaceAll('&#x3A;', ':')
    .replaceAll('&#58;', ':');
}
