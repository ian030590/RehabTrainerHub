'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

type SubmissionType = 'idea' | 'demo';
type SubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';

const maxHtmlBytes = 180 * 1024;

export function SubmissionForm() {
  const [submissionType, setSubmissionType] = useState<SubmissionType>('idea');
  const [status, setStatus] = useState<SubmissionStatus>('idle');
  const [message, setMessage] = useState('');
  const [fileName, setFileName] = useState('');

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('type', submissionType);

    setStatus('submitting');
    setMessage('');

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const details = Array.isArray(data.details) ? `：${data.details.join('、')}` : '';
        throw new Error(`${data.error || '投稿失敗'}${details}`);
      }

      form.reset();
      setFileName('');
      setSubmissionType('idea');
      setStatus('success');
      setMessage('已送出。HTML 投稿已通過安全檢查後才轉送。');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '投稿失敗，請稍後再試。');
    }
  };

  return (
    <form className="submission-form" onSubmit={submitForm}>
      <fieldset className="submission-type" aria-label="投稿類型">
        <label className={submissionType === 'idea' ? 'is-selected' : ''}>
          <input
            checked={submissionType === 'idea'}
            name="submissionType"
            onChange={() => setSubmissionType('idea')}
            type="radio"
            value="idea"
          />
          <span>活動想法</span>
        </label>
        <label className={submissionType === 'demo' ? 'is-selected' : ''}>
          <input
            checked={submissionType === 'demo'}
            name="submissionType"
            onChange={() => setSubmissionType('demo')}
            type="radio"
            value="demo"
          />
          <span>HTML Demo</span>
        </label>
      </fieldset>

      <div className="form-grid">
        <label className="field">
          <span>標題</span>
          <input maxLength={80} name="title" required type="text" />
        </label>

        <label className="field">
          <span>姓名或單位</span>
          <input maxLength={80} name="name" type="text" />
        </label>

        <label className="field">
          <span>聯絡方式</span>
          <input maxLength={120} name="contact" type="text" />
        </label>
      </div>

      {submissionType === 'idea' ? (
        <label className="field">
          <span>活動想法</span>
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
            <span>Demo 說明</span>
            <textarea
              maxLength={1500}
              minLength={20}
              name="description"
              required
              rows={5}
            />
          </label>

          <label className="file-field">
            <span>單一 HTML 檔案</span>
            <input
              accept=".html,text/html"
              name="demoFile"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) {
                  setFileName('');
                  return;
                }
                setFileName(file.size > maxHtmlBytes ? `${file.name} 檔案太大` : file.name);
              }}
              required
              type="file"
            />
            <strong>{fileName || '只能上傳 .html，180 KB 以內。'}</strong>
          </label>
        </>
      )}

      <input aria-hidden="true" autoComplete="off" className="submission-honey" name="website" tabIndex={-1} />

      <button className="primary-action" disabled={status === 'submitting'} type="submit">
        {status === 'submitting' ? '送出中' : '送出投稿'}
      </button>

      {message && (
        <p className={`submission-status ${status === 'error' ? 'is-error' : 'is-success'}`} role="status">
          {message}
        </p>
      )}
    </form>
  );
}
