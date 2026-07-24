'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CardImagePlaceholder } from '@rehab-trainer/ui/components/CardImagePlaceholder';
import type {
  Article,
  ArticleCard,
  ArticleInput,
  ArticleStatus,
} from '../articleTypes';
import {
  AdminApiError,
  CreateAdminArticle,
  DeleteAdminArticle,
  FetchAdminArticle,
  FetchAdminArticles,
  UpdateAdminArticle,
  UploadAdminAsset,
} from './adminApi';

interface ArticleManagerProps {
  onArticlesChanged: () => void;
}

interface ArticleFormState {
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  coverImageUrl: string | null;
  status: ArticleStatus;
}

const emptyArticleForm: ArticleFormState = {
  slug: '',
  title: '',
  summary: '',
  content: '',
  category: '',
  coverImageUrl: null,
  status: 'draft',
};

const maxCoverImageBytes = 5 * 1024 * 1024;
const allowedCoverImageTypes = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type LoadStatus = 'loading' | 'ready' | 'error';

function ToArticleForm(article: Article): ArticleFormState {
  return {
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    content: article.content,
    category: article.category,
    coverImageUrl: article.coverImageUrl,
    status: article.status,
  };
}

function FormatDate(value: string | null): string {
  if (!value) return '尚未發布';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function BuildArticleInput(form: ArticleFormState): ArticleInput {
  return {
    slug: form.slug.trim() || undefined,
    title: form.title.trim(),
    summary: form.summary.trim(),
    content: form.content.trim(),
    category: form.category.trim(),
    coverImageUrl: form.coverImageUrl,
    status: form.status,
  };
}

export function ArticleManager({ onArticlesChanged }: ArticleManagerProps) {
  const [articles, setArticles] = useState<ArticleCard[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [loadKey, setLoadKey] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [operationMessage, setOperationMessage] = useState('');
  const [busyArticleId, setBusyArticleId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ArticleFormState>(emptyArticleForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setLoadError('');
    void FetchAdminArticles(controller.signal)
      .then((nextArticles) => {
        setArticles(nextArticles);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Unable to load education articles.', error);
        setLoadError('目前無法載入衛教文章，請稍後再試。');
        setStatus('error');
      });
    return () => controller.abort();
  }, [loadKey]);

  const resetEditor = () => {
    setEditingId(null);
    setForm(emptyArticleForm);
    setCoverFile(null);
    setFileInputKey((current) => current + 1);
  };

  const openNewEditor = () => {
    resetEditor();
    setOperationError('');
    setOperationMessage('');
    setIsEditorOpen(true);
  };

  const openEditEditor = async (article: ArticleCard) => {
    setBusyArticleId(article.id);
    setOperationError('');
    setOperationMessage('');
    try {
      const fullArticle = await FetchAdminArticle(article.id);
      setEditingId(article.id);
      setForm(ToArticleForm(fullArticle));
      setCoverFile(null);
      setFileInputKey((current) => current + 1);
      setIsEditorOpen(true);
    } catch (error) {
      console.warn('Unable to load education article detail.', error);
      setOperationError('無法載入文章內容，請稍後再試。');
    } finally {
      setBusyArticleId(null);
    }
  };

  const closeEditor = () => {
    if (isSaving) return;
    setIsEditorOpen(false);
    resetEditor();
  };

  const updateForm = <Key extends keyof ArticleFormState>(
    key: Key,
    value: ArticleFormState[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectCoverFile = (file: File | null) => {
    setOperationError('');
    if (!file) {
      setCoverFile(null);
      return;
    }
    if (!allowedCoverImageTypes.has(file.type)) {
      setCoverFile(null);
      setFileInputKey((current) => current + 1);
      setOperationError('封面圖片格式不支援，請使用 JPEG、PNG、GIF、WebP 或 AVIF。');
      return;
    }
    if (file.size <= 0 || file.size > maxCoverImageBytes) {
      setCoverFile(null);
      setFileInputKey((current) => current + 1);
      setOperationError('封面圖片必須小於 5 MB。');
      return;
    }
    setCoverFile(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOperationError('');
    setOperationMessage('');

    if (!form.title.trim() || !form.summary.trim() || !form.content.trim() || !form.category.trim()) {
      setOperationError('請填寫標題、摘要、分類與文章內容。');
      return;
    }

    setIsSaving(true);
    try {
      let coverImageUrl = form.coverImageUrl;
      if (coverFile) {
        const uploadedAsset = await UploadAdminAsset(coverFile);
        coverImageUrl = uploadedAsset.url;
      }

      const input = BuildArticleInput({ ...form, coverImageUrl });
      const savedArticle = editingId
        ? await UpdateAdminArticle(editingId, input)
        : await CreateAdminArticle(input);

      setArticles((current) => (
        editingId
          ? current.map((article) => (article.id === savedArticle.id ? savedArticle : article))
          : [savedArticle, ...current]
      ));
      setOperationMessage(editingId ? '文章已更新。' : '文章已新增。');
      setIsEditorOpen(false);
      resetEditor();
      onArticlesChanged();
    } catch (error) {
      console.warn('Unable to save education article.', error);
      if (error instanceof AdminApiError && error.status === 409) {
        setOperationError('網址代稱已被其他文章使用，請更換後再試。');
      } else if (error instanceof AdminApiError && error.status === 413) {
        setOperationError('封面圖片超過 5 MB，請縮小圖片後再試。');
      } else if (error instanceof AdminApiError && error.status === 503 && coverFile) {
        setOperationError('封面儲存空間尚未設定；可先移除封面並儲存文章。');
      } else {
        setOperationError('文章儲存失敗，請檢查內容或稍後再試。');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (article: ArticleCard) => {
    const nextStatus: ArticleStatus = article.status === 'published' ? 'draft' : 'published';
    setBusyArticleId(article.id);
    setOperationError('');
    setOperationMessage('');
    try {
      const updatedArticle = await UpdateAdminArticle(article.id, { status: nextStatus });
      setArticles((current) => current.map((item) => (
        item.id === updatedArticle.id ? updatedArticle : item
      )));
      setOperationMessage(nextStatus === 'published' ? '文章已發布。' : '文章已轉為草稿。');
      onArticlesChanged();
    } catch (error) {
      console.warn('Unable to update article status.', error);
      setOperationError('無法變更文章狀態，請稍後再試。');
    } finally {
      setBusyArticleId(null);
    }
  };

  const handleDelete = async (article: ArticleCard) => {
    if (!window.confirm(`確定要刪除「${article.title}」嗎？此操作無法復原。`)) return;

    setBusyArticleId(article.id);
    setOperationError('');
    setOperationMessage('');
    try {
      await DeleteAdminArticle(article.id);
      setArticles((current) => current.filter((item) => item.id !== article.id));
      if (editingId === article.id) {
        setIsEditorOpen(false);
        resetEditor();
      }
      setOperationMessage('文章已刪除。');
      onArticlesChanged();
    } catch (error) {
      console.warn('Unable to delete education article.', error);
      setOperationError('文章刪除失敗，請稍後再試。');
    } finally {
      setBusyArticleId(null);
    }
  };

  return (
    <div className="admin-article-manager">
      <div className="admin-section-toolbar">
        <div>
          <p className="page-kicker">Patient education</p>
          <h2>衛教文章</h2>
          <p>文章發布後，會以 Card 顯示在問答中心。</p>
        </div>
        <button className="admin-button admin-button-primary" onClick={openNewEditor} type="button">
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
          新增文章
        </button>
      </div>

      {operationError && <p className="admin-alert admin-alert-error" role="alert">{operationError}</p>}
      {operationMessage && (
        <p className="admin-alert admin-alert-success" role="status">{operationMessage}</p>
      )}

      {isEditorOpen && (
        <section className="admin-editor-panel" aria-labelledby="article-editor-title">
          <div className="admin-editor-heading">
            <div>
              <p className="page-kicker">{editingId ? 'Edit article' : 'New article'}</p>
              <h3 id="article-editor-title">{editingId ? '編輯衛教文章' : '新增衛教文章'}</h3>
            </div>
            <button
              aria-label="關閉文章編輯器"
              className="admin-icon-button"
              disabled={isSaving}
              onClick={closeEditor}
              type="button"
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>

          <form className="admin-article-form" onSubmit={handleSubmit}>
            <div className="admin-form-grid">
              <label className="admin-field admin-field-wide">
                <span>文章標題</span>
                <input
                  maxLength={160}
                  onChange={(event) => updateForm('title', event.target.value)}
                  required
                  type="text"
                  value={form.title}
                />
              </label>

              <label className="admin-field">
                <span>分類</span>
                <input
                  maxLength={60}
                  onChange={(event) => updateForm('category', event.target.value)}
                  placeholder="例如：中風復健"
                  required
                  type="text"
                  value={form.category}
                />
              </label>

              <label className="admin-field">
                <span>網址代稱（選填）</span>
                <input
                  aria-describedby="article-slug-help"
                  maxLength={100}
                  onChange={(event) => updateForm('slug', event.target.value)}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="例如：stroke-home-exercise"
                  type="text"
                  value={form.slug}
                />
                <small id="article-slug-help">僅使用小寫英文字母、數字與連字號；留空會自動產生。</small>
              </label>

              <label className="admin-field admin-field-wide">
                <span>Card 摘要</span>
                <textarea
                  maxLength={320}
                  onChange={(event) => updateForm('summary', event.target.value)}
                  required
                  rows={3}
                  value={form.summary}
                />
              </label>

              <label className="admin-field admin-field-wide">
                <span>文章內容</span>
                <textarea
                  aria-describedby="article-content-help"
                  onChange={(event) => updateForm('content', event.target.value)}
                  required
                  rows={12}
                  value={form.content}
                />
                <small id="article-content-help">內容會以純文字顯示；換行會保留，不會執行 HTML。</small>
              </label>

              <label className="admin-field">
                <span>文章狀態</span>
                <select
                  onChange={(event) => updateForm('status', event.target.value as ArticleStatus)}
                  value={form.status}
                >
                  <option value="draft">草稿</option>
                  <option value="published">發布</option>
                </select>
              </label>

              <label className="admin-field">
                <span>封面圖片（選填）</span>
                <input
                  accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                  key={fileInputKey}
                  onChange={(event) => selectCoverFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
                <small>
                  {coverFile
                    ? `已選擇：${coverFile.name}`
                    : '支援 JPEG、PNG、GIF、WebP 或 AVIF，檔案上限 5 MB。'}
                </small>
              </label>
            </div>

            {(form.coverImageUrl || coverFile) && (
              <div className="admin-cover-preview">
                {form.coverImageUrl ? (
                  <img alt="" src={form.coverImageUrl} />
                ) : (
                  <span className="material-symbols-outlined" aria-hidden="true">image</span>
                )}
                <div>
                  <strong>{coverFile ? '儲存時將上傳新封面' : '目前封面'}</strong>
                  <button
                    className="admin-text-button"
                    onClick={() => {
                      updateForm('coverImageUrl', null);
                      setCoverFile(null);
                      setFileInputKey((current) => current + 1);
                    }}
                    type="button"
                  >
                    移除封面
                  </button>
                </div>
              </div>
            )}

            <div className="admin-form-actions">
              <button
                className="admin-button admin-button-primary"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? '儲存中…' : form.status === 'published' ? '儲存並發布' : '儲存草稿'}
              </button>
              <button
                className="admin-button admin-button-secondary"
                disabled={isSaving}
                onClick={closeEditor}
                type="button"
              >
                取消
              </button>
            </div>
          </form>
        </section>
      )}

      {status === 'loading' && (
        <div className="admin-state" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">progress_activity</span>
          <p>正在載入衛教文章…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="admin-state admin-state-error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <p>{loadError}</p>
          <button
            className="admin-button admin-button-secondary"
            onClick={() => setLoadKey((current) => current + 1)}
            type="button"
          >
            重新載入
          </button>
        </div>
      )}

      {status === 'ready' && articles.length === 0 && (
        <div className="admin-state">
          <span className="material-symbols-outlined" aria-hidden="true">article</span>
          <h3>尚無衛教文章</h3>
          <p>新增第一篇文章後，可先存成草稿或直接發布。</p>
        </div>
      )}

      {status === 'ready' && articles.length > 0 && (
        <div className="admin-article-list" aria-label="衛教文章清單">
          {articles.map((article) => {
            const isBusy = busyArticleId === article.id;
            return (
              <article className="admin-article-card" key={article.id}>
                <div className="admin-article-thumbnail">
                  {article.coverImageUrl ? (
                    <img alt="" loading="lazy" src={article.coverImageUrl} />
                  ) : (
                    <CardImagePlaceholder />
                  )}
                </div>
                <div className="admin-article-card-content">
                  <div className="admin-article-meta">
                    <span>{article.category || '未分類'}</span>
                    <span className={`admin-status-badge is-${article.status}`}>
                      {article.status === 'published' ? '已發布' : '草稿'}
                    </span>
                  </div>
                  <h3>{article.title}</h3>
                  <p>{article.summary || '尚未填寫摘要。'}</p>
                  <small>
                    {article.authorName} ·{' '}
                    <time dateTime={article.publishedAt ?? article.updatedAt}>
                      {FormatDate(article.publishedAt ?? article.updatedAt)}
                    </time>
                  </small>
                </div>
                <div className="admin-article-actions">
                  <button
                    className="admin-button admin-button-secondary"
                    disabled={isBusy}
                    onClick={() => void openEditEditor(article)}
                    type="button"
                  >
                    編輯
                  </button>
                  <button
                    className="admin-button admin-button-secondary"
                    disabled={isBusy}
                    onClick={() => void handleStatusChange(article)}
                    type="button"
                  >
                    {isBusy
                      ? '處理中…'
                      : article.status === 'published'
                        ? '轉為草稿'
                        : '發布'}
                  </button>
                  <button
                    className="admin-button admin-button-danger"
                    disabled={isBusy}
                    onClick={() => void handleDelete(article)}
                    type="button"
                  >
                    刪除
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
