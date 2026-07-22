import {
  CreateRelatedTrainerLinks,
  GetDefaultRelatedLinksPageLabels,
  RelatedLinksGridPage,
} from '@rehab-trainer/ui/components/RelatedLinksGridPage';
import { useT } from '../../i18n';
import { siteUrls } from '../../utils/siteUrls';

export function LinksPage() {
  const { lang } = useT();
  const labels = GetDefaultRelatedLinksPageLabels(lang);

  return (
    <RelatedLinksGridPage
      title={labels.title}
      subtitle={labels.subtitle}
      links={CreateRelatedTrainerLinks({ currentSite: 'vision', language: lang, siteUrls })}
    />
  );
}
