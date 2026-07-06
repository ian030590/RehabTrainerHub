'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useHubReadability } from '../HubNavigation';
import type { HubLocale } from '../i18n/types';

type SubmissionType = 'idea' | 'demo';
type SubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';

const maxHtmlBytes = 180 * 1024;

type FormCopyEntry = {
  typeLabel: string;
  ideaType: string;
  demoType: string;
  title: string;
  name: string;
  contact: string;
  ideaText: string;
  description: string;
  htmlFile: string;
  fileHint: string;
  fileTooLarge: string;
  submit: string;
  submitting: string;
  success: string;
  fallbackError: string;
};

const formCopy: Record<HubLocale, FormCopyEntry> = {
  'zh-TW': {
    typeLabel: '投稿類型',
    ideaType: '文字說明',
    demoType: 'HTML檔案',
    title: '活動名稱',
    name: '投稿人員',
    contact: '聯絡方式',
    ideaText: '活動大綱',
    description: '範例說明',
    htmlFile: '單一 HTML 檔案',
    fileHint: '請上傳單一html檔案，180 KB 以內。',
    fileTooLarge: '檔案太大',
    submit: '送出投稿',
    submitting: '正在送出',
    success: '投稿已送出。HTML 投稿會在通過安全檢查後才轉送。',
    fallbackError: '投稿失敗，請稍後再試。',
  },
  en: {
    typeLabel: 'Submission type',
    ideaType: 'Text Description',
    demoType: 'HTML File',
    title: 'Activity Name',
    name: 'Submitter',
    contact: 'Contact',
    ideaText: 'Descriptions',
    description: 'Example description',
    htmlFile: 'Single HTML file',
    fileHint: 'Upload one .html file, 180 KB or smaller.',
    fileTooLarge: 'file too large',
    submit: 'Send submission',
    submitting: 'Sending submission',
    success: 'The submission has been sent. HTML submissions are forwarded only after passing the safety check.',
    fallbackError: 'The submission failed. Please try again later.',
  },
};

export function SubmissionForm() {
  const { locale } = useHubReadability();
  const copy = formCopy[locale];
  const [submissionType, setSubmissionType] = useState<SubmissionType>('idea');
  const [status, setStatus] = useState<SubmissionStatus>('idle');
  const [message, setMessage] = useState('');
  const [fileName, setFileName] = useState('');

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('type', submissionType);
    formData.set('locale', locale);

    setStatus('submitting');
    setMessage('');

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const details = Array.isArray(data.details)
          ? `${locale === 'en' ? ': ' : '：'}${data.details.join(locale === 'en' ? ', ' : '、')}`
          : '';
        throw new Error(`${data.error || copy.fallbackError}${details}`);
      }

      form.reset();
      setFileName('');
      setSubmissionType('idea');
      setStatus('success');
      setMessage(copy.success);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : copy.fallbackError);
    }
  };

  return (
    <form className="submission-form" onSubmit={submitForm}>
      <fieldset className="submission-type" aria-label={copy.typeLabel}>
        <label className={submissionType === 'idea' ? 'is-selected' : ''}>
          <input
            checked={submissionType === 'idea'}
            name="submissionType"
            onChange={() => setSubmissionType('idea')}
            type="radio"
            value="idea"
          />
          <span>{copy.ideaType}</span>
        </label>
        <label className={submissionType === 'demo' ? 'is-selected' : ''}>
          <input
            checked={submissionType === 'demo'}
            name="submissionType"
            onChange={() => setSubmissionType('demo')}
            type="radio"
            value="demo"
          />
          <span>{copy.demoType}</span>
        </label>
      </fieldset>

      <div className="form-grid">
        <label className="field">
          <span>{copy.title}</span>
          <input maxLength={80} name="title" required type="text" />
        </label>

        <label className="field">
          <span>{copy.name}</span>
          <input maxLength={80} name="name" type="text" />
        </label>

        <label className="field">
          <span>{copy.contact}</span>
          <input maxLength={120} name="contact" type="text" />
        </label>
      </div>

      {submissionType === 'idea' ? (
        <label className="field">
          <span>{copy.ideaText}</span>
          <textarea
            maxLength={4000}
            minLength={20}
            name="ideaText"
            required
            rows={8}
          />
        </label>
      ) : (
        <>
          <label className="field">
            <span>{copy.description}</span>
            <textarea
              maxLength={1500}
              minLength={20}
              name="description"
              required
              rows={5}
            />
          </label>

          <label className="file-field">
            <span>{copy.htmlFile}</span>
            <input
              accept=".html,text/html"
              name="demoFile"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) {
                  setFileName('');
                  return;
                }
                setFileName(file.size > maxHtmlBytes ? `${file.name} ${copy.fileTooLarge}` : file.name);
              }}
              required
              type="file"
            />
            <strong>{fileName || copy.fileHint}</strong>
          </label>
        </>
      )}

      <input aria-hidden="true" autoComplete="off" className="submission-honey" name="website" tabIndex={-1} />

      <button className="primary-action" disabled={status === 'submitting'} type="submit">
        {status === 'submitting' ? copy.submitting : copy.submit}
      </button>

      {message && (
        <p className={`submission-status ${status === 'error' ? 'is-error' : 'is-success'}`} role="status">
          {message}
        </p>
      )}
    </form>
  );
}
