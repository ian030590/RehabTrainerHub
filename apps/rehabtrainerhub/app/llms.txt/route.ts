import { hubFullName, hubLocalName } from '../hubBrand';
import { siteDescription } from '../seo';
import { siteUrls } from '../siteUrls';

export const dynamic = 'force-static';

const hubUrl = `${siteUrls.hub}/`;

const llmsText = `# ${hubLocalName}

> ${siteDescription}

${hubFullName} provides general self-directed home-practice tools and educational information. Session records and converted reference values describe the current activity only; they are not individualized assessment, diagnosis, medical orders, treatment, eyesight, contrast sensitivity, or treatment outcomes.

## Key pages

- [Training lobby](${hubUrl}): Browse built-in activities and reviewed developer games for movement, visual, cognitive, and oral practice.
- [About the site and contact options](${hubUrl}about/): Read the site's scope, content responsibility, platform safeguards, public source repository, and issue-reporting channel.
- [Educational information and author background](${hubUrl}qa/): Read the author background, professional-content boundaries, and published educational articles.
- [Install the app](${hubUrl}download/): Install the platform on desktop, iPhone, or Android devices.
- [Privacy policy](${hubUrl}privacy/): Review account, activity-record, device-permission, and data-use practices.

## Platform information

- [XML sitemap](${hubUrl}sitemap.xml): Canonical public pages intended for search discovery.
`;

export function GET() {
  return new Response(llmsText, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
