'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  GetTrainingPurposeTrainerId,
  trainerCategoryTags,
  trainingPurposes,
  type TrainerCatalogId,
  type TrainingPurposeId,
} from '@rehab-trainer/hub-modules/catalog';
import { useHubAuth } from '../HubNavigation';
import { useHubLanguage } from '../i18n/HubLanguage';
import { DeveloperGuide } from './DeveloperGuide';
import { GetDeveloperCopy } from './developerCopy';
import {
  FetchDeveloperGames,
  SubmitDeveloperGame,
  type DeveloperGame,
} from './developerApi';

const maximumPackageBytes = 12 * 1024 * 1024;
const platformJsPsychVersion = '8.2.3';
const capabilityValues = ['audio', 'fullscreen', 'keyboard', 'pointer'] as const;
const categoryOptions = trainingPurposes.map((theme) => ({
  label: theme.label,
  trainer: GetTrainingPurposeTrainerId(theme.id),
  value: theme.id,
}));

export function DeveloperPortal() {
  const { user } = useHubAuth();
  const { language, locale } = useHubLanguage();
  const copy = GetDeveloperCopy(language);
  const [games, setGames] = useState<DeveloperGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [packageFile, setPackageFile] = useState<File | null>(null);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [developerName, setDeveloperName] = useState('');
  const [summary, setSummary] = useState('');
  const [trainer, setTrainer] = useState<TrainerCatalogId | ''>('');
  const [category, setCategory] = useState<TrainingPurposeId | ''>('');
  const [version, setVersion] = useState('1.0.0');
  const [capabilities, setCapabilities] = useState<string[]>(['keyboard', 'pointer']);
  const [sourceConfirmed, setSourceConfirmed] = useState(false);

  useEffect(() => {
    if (!user) {
      setGames([]);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    void FetchDeveloperGames(controller.signal)
      .then(setGames)
      .catch((nextError: unknown) => {
        if (controller.signal.aborted) return;
        setError(nextError instanceof Error ? nextError.message : copy.submission.errors.load);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [copy.submission.errors.load, loadKey, user]);

  const releaseCount = useMemo(
    () => games.reduce((count, game) => count + game.releases.length, 0),
    [games],
  );

  const toggleCapability = (capability: string) => {
    setCapabilities((current) => (
      current.includes(capability)
        ? current.filter((item) => item !== capability)
        : [...current, capability]
    ));
  };

  const selectPackage = (file: File | null) => {
    setError('');
    if (!file) {
      setPackageFile(null);
      return;
    }
    const extensionAllowed = /\.(?:html?|zip)$/i.test(file.name);
    if (!extensionAllowed || file.size <= 0 || file.size > maximumPackageBytes) {
      setPackageFile(null);
      setError(copy.submission.errors.file);
      return;
    }
    setPackageFile(file);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!packageFile || !sourceConfirmed || !trainer || !category) {
      setError(copy.submission.errors.incomplete);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await SubmitDeveloperGame({
        packageFile,
        slug: slug.trim(),
        title: title.trim(),
        developerName: developerName.trim(),
        summary: summary.trim(),
        trainer,
        category,
        version: version.trim(),
        jsPsychVersion: platformJsPsychVersion,
        capabilities,
      });
      setMessage(response.release.status === 'blocked'
        ? copy.submission.messages.blocked(response.release.scan.blockCount ?? response.release.findings.length)
        : copy.submission.messages.pending);
      setPackageFile(null);
      setSourceConfirmed(false);
      setLoadKey((current) => current + 1);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : copy.submission.errors.submit);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="admin-page developer-page" id="main-content">
      <DeveloperGuide>
        <section className="developer-doc-section developer-submission-section" id="submission">
          <header>
            <p className="page-kicker">{copy.submission.eyebrow}</p>
            <h2>{user ? copy.submission.uploadTitle : copy.submission.signedOutTitle}</h2>
          </header>

          {!user ? (
            <div className="developer-sign-in-notice">
              <span className="developer-native-icon" aria-hidden="true">◎</span>
              <p>{copy.submission.signedOutBody}</p>
            </div>
          ) : (
            <div className="developer-layout">
              <section className="admin-tab-panel" aria-labelledby="developer-upload-title">
                <h3 id="developer-upload-title">{copy.submission.uploadTitle}</h3>
                <form className="developer-upload-form" onSubmit={(event) => void submit(event)}>
                  <label className="admin-field">
                    <span>{copy.submission.slug}</span>
                    <input
                      autoComplete="off"
                      maxLength={48}
                      onChange={(event) => setSlug(event.target.value.toLowerCase())}
                      pattern="[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?"
                      placeholder="target-click"
                      required
                      value={slug}
                    />
                    <small>{copy.submission.slugHelp}</small>
                  </label>

                  <label className="admin-field">
                    <span>{copy.submission.displayName}</span>
                    <input maxLength={120} minLength={2} onChange={(event) => setTitle(event.target.value)} required value={title} />
                  </label>

                  <label className="admin-field">
                    <span>{copy.submission.developerName}</span>
                    <input maxLength={80} minLength={2} onChange={(event) => setDeveloperName(event.target.value)} required value={developerName} />
                    <small>{copy.submission.developerHelp}</small>
                  </label>

                  <label className="admin-field">
                    <span>{copy.submission.summary}</span>
                    <textarea maxLength={500} onChange={(event) => setSummary(event.target.value)} rows={4} value={summary} />
                  </label>

                  <div className="developer-field-row developer-tag-row">
                    <label className="admin-field">
                      <span>{copy.submission.trainer}</span>
                      <select
                        onChange={(event) => {
                          setTrainer(event.target.value as TrainerCatalogId);
                          setCategory('');
                        }}
                        required
                        value={trainer}
                      >
                        <option disabled value="">{copy.submission.trainerPlaceholder}</option>
                        {trainerCategoryTags.map((option) => (
                          <option key={option.id} value={option.id}>{option.label[locale]} ({option.id})</option>
                        ))}
                      </select>
                      <small>{copy.submission.trainerHelp}</small>
                    </label>
                    <label className="admin-field">
                      <span>{copy.submission.category}</span>
                      <select
                        disabled={!trainer}
                        onChange={(event) => setCategory(event.target.value as TrainingPurposeId)}
                        required
                        value={category}
                      >
                        <option disabled value="">{copy.submission.categoryPlaceholder}</option>
                        {categoryOptions
                          .filter((option) => option.trainer === trainer)
                          .map((option) => (
                            <option key={option.value} value={option.value}>{option.label[locale]}</option>
                          ))}
                      </select>
                      <small>{copy.submission.categoryHelp}</small>
                    </label>
                  </div>

                  <div className="developer-field-row developer-version-row">
                    <label className="admin-field">
                      <span>{copy.submission.version}</span>
                      <input
                        maxLength={64}
                        onChange={(event) => setVersion(event.target.value)}
                        pattern="(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
                        required
                        value={version}
                      />
                    </label>
                    <label className="admin-field">
                      <span>{copy.submission.jsPsychVersion}</span>
                      <input aria-describedby="platform-jspsych-help" readOnly value={platformJsPsychVersion} />
                      <small id="platform-jspsych-help">{copy.submission.jsPsychHelp}</small>
                    </label>
                  </div>

                  <fieldset className="developer-capabilities">
                    <legend>{copy.submission.capabilities}</legend>
                    {capabilityValues.map((value) => (
                      <label key={value}>
                        <input
                          checked={capabilities.includes(value)}
                          onChange={() => toggleCapability(value)}
                          type="checkbox"
                        />
                        <span>{copy.submission.capabilityLabels[value]}</span>
                      </label>
                    ))}
                  </fieldset>

                  <label className="admin-field">
                    <span>{copy.submission.package}</span>
                    <input
                      accept=".html,.htm,.zip,text/html,application/zip"
                      onChange={(event) => selectPackage(event.target.files?.[0] ?? null)}
                      required
                      type="file"
                    />
                    <small>{packageFile ? `${packageFile.name} (${FormatBytes(packageFile.size)})` : copy.submission.packageLimit}</small>
                  </label>

                  <label className="developer-confirmation">
                    <input checked={sourceConfirmed} onChange={(event) => setSourceConfirmed(event.target.checked)} required type="checkbox" />
                    <span>{copy.submission.confirmation}</span>
                  </label>

                  {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
                  {message && <p className="admin-alert admin-alert-warning" role="status">{message}</p>}
                  <button className="admin-button admin-button-primary" disabled={isSubmitting} type="submit">
                    <span className="developer-native-icon" aria-hidden="true">↑</span>
                    {isSubmitting ? copy.submission.submitting : copy.submission.submit}
                  </button>
                </form>
              </section>

              <section className="admin-tab-panel" aria-labelledby="developer-releases-title">
                <div className="section-title-row">
                  <div>
                    <p className="page-kicker">{copy.submission.releasesEyebrow}</p>
                    <h3 id="developer-releases-title">{copy.submission.releasesTitle}</h3>
                  </div>
                  <p>{copy.submission.counts(games.length, releaseCount)}</p>
                </div>
                {isLoading && <p role="status">{copy.submission.loading}</p>}
                {!isLoading && games.length === 0 && <p>{copy.submission.empty}</p>}
                <div className="developer-release-list">
                  {games.map((game) => (
                    <article className="developer-release-card" key={game.id}>
                      <div>
                        <p className="page-kicker">{game.slug}</p>
                        <h4>{game.title}</h4>
                        <p>{copy.submission.developer}: {game.developerName}</p>
                        <p>
                          {copy.submission.trainerLabel}: {trainerCategoryTags.find((tag) => tag.id === game.trainer)?.label[locale] ?? game.trainer}
                          {' · '}
                          {copy.submission.categoryLabel}: {categoryOptions.find((tag) => tag.value === game.category)?.label[locale] ?? game.category}
                        </p>
                        {game.summary && <p>{game.summary}</p>}
                      </div>
                      <ul>
                        {game.releases.map((release) => (
                          <li key={release.id}>
                            <div>
                              <strong>v{release.version}</strong>
                              <span className={`release-status release-status-${release.status}`}>{copy.submission.status[release.status]}</span>
                            </div>
                            <small>
                              {release.fileCount} {copy.submission.fileCount} · {FormatBytes(release.uncompressedBytes)} · SHA-256 {release.contentSha256.slice(0, 12)}…
                            </small>
                            {release.reviewNote && <p>{copy.submission.reviewNote}: {release.reviewNote}</p>}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      </DeveloperGuide>
    </main>
  );
}

function FormatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
