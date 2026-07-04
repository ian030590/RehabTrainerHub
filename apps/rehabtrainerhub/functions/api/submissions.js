import { errorResponse, jsonResponse, optionsResponse } from '../_lib/auth.js';

const MAX_TITLE_LENGTH = 80;
const MAX_NAME_LENGTH = 80;
const MAX_CONTACT_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1500;
const MAX_IDEA_LENGTH = 4000;
const MAX_HTML_BYTES = 180 * 1024;
const WEBHOOK_ENV_NAME = 'REHAB_SUBMISSION_WEBHOOK_URL';

const submissionMessages = {
  'zh-TW': {
    invalidForm: '投稿格式不正確。',
    invalidType: '投稿類型不正確。',
    titleRequired: '請填寫標題。',
    ideaTooShort: '活動想法至少需要 20 個字。',
    descriptionTooShort: 'Demo 說明至少需要 20 個字。',
    fileRequired: '請上傳一個 HTML 檔。',
    fileType: '只接受 .html 檔。',
    fileSize: 'HTML 檔案需小於 180 KB。',
    htmlFailed: 'HTML 安全檢查未通過。',
    webhookMissing: '投稿尚未送出。請確認 Discord webhook secret 已設定。',
    emptyHtml: 'HTML 內容是空的',
    missingHtmlStructure: '缺少基本 HTML 結構',
    scanPassed: (size) => `HTML 安全檢查通過。檔案 ${size} bytes。`,
    forbidden: {
      script: '包含 script 標籤',
      inlineEvent: '包含 inline 事件處理器',
      javascriptUrl: '包含 javascript: 連結',
      embeddedContent: '包含可送出資料或嵌入外部內容的標籤',
      formAction: '包含表單送出目標',
      fileInput: '包含檔案讀取欄位',
      link: '包含外部資源 link 標籤',
      base: '包含 base 標籤',
      httpEquiv: '包含 http-equiv meta 標籤',
      cssImport: '包含 CSS import',
      cssUrl: '包含 CSS url() 資源',
      fetch: '包含 fetch 連線程式',
      xhr: '包含 XMLHttpRequest 連線程式',
      realtime: '包含即時連線程式',
      browserStorage: '嘗試讀寫瀏覽器資料',
      permission: '嘗試使用瀏覽器權限',
      devicePermission: '嘗試取得裝置或通知權限',
      worker: '包含背景執行程式',
      postMessage: '包含跨視窗訊息程式',
      url: '包含外部或特殊網址',
      protocolRelative: '包含 protocol-relative URL',
    },
  },
  en: {
    invalidForm: 'The submission format is invalid.',
    invalidType: 'The submission type is invalid.',
    titleRequired: 'Please enter a title.',
    ideaTooShort: 'Activity ideas must be at least 20 characters.',
    descriptionTooShort: 'Demo descriptions must be at least 20 characters.',
    fileRequired: 'Please upload one HTML file.',
    fileType: 'Only .html files are accepted.',
    fileSize: 'HTML files must be smaller than 180 KB.',
    htmlFailed: 'The HTML safety check did not pass.',
    webhookMissing: 'The submission was not sent. Please confirm the Discord webhook secret is configured.',
    emptyHtml: 'HTML content is empty',
    missingHtmlStructure: 'Basic HTML structure is missing',
    scanPassed: (size) => `HTML safety check passed. File size: ${size} bytes.`,
    forbidden: {
      script: 'Contains a script tag',
      inlineEvent: 'Contains an inline event handler',
      javascriptUrl: 'Contains a javascript: link',
      embeddedContent: 'Contains a tag that can submit data or embed external content',
      formAction: 'Contains a form submission target',
      fileInput: 'Contains a file input field',
      link: 'Contains an external resource link tag',
      base: 'Contains a base tag',
      httpEquiv: 'Contains an http-equiv meta tag',
      cssImport: 'Contains a CSS import',
      cssUrl: 'Contains a CSS url() resource',
      fetch: 'Contains fetch networking code',
      xhr: 'Contains XMLHttpRequest networking code',
      realtime: 'Contains realtime connection code',
      browserStorage: 'Attempts to read or write browser data',
      permission: 'Attempts to use browser permissions',
      devicePermission: 'Attempts to request device or notification permissions',
      worker: 'Contains background worker code',
      postMessage: 'Contains cross-window messaging code',
      url: 'Contains an external or special URL',
      protocolRelative: 'Contains a protocol-relative URL',
    },
  },
};

const forbiddenHtmlPatterns = [
  { pattern: /<\s*script\b/i, key: 'script' },
  { pattern: /\son[a-z0-9_-]+\s*=/i, key: 'inlineEvent' },
  { pattern: /javascript\s*:/i, key: 'javascriptUrl' },
  { pattern: /<\s*(iframe|object|embed|applet|form)\b/i, key: 'embeddedContent' },
  { pattern: /\s(formaction|action)\s*=/i, key: 'formAction' },
  { pattern: /<\s*input\b[^>]*\btype\s*=\s*["']?file/i, key: 'fileInput' },
  { pattern: /<\s*link\b/i, key: 'link' },
  { pattern: /<\s*base\b/i, key: 'base' },
  { pattern: /<\s*meta\b[^>]*http-equiv\s*=/i, key: 'httpEquiv' },
  { pattern: /@\s*import\b/i, key: 'cssImport' },
  { pattern: /url\s*\(/i, key: 'cssUrl' },
  { pattern: /\bfetch\s*\(/i, key: 'fetch' },
  { pattern: /\bXMLHttpRequest\b/i, key: 'xhr' },
  { pattern: /\bnavigator\.sendBeacon\b/i, key: 'fetch' },
  { pattern: /\b(WebSocket|EventSource|RTCPeerConnection)\b/i, key: 'realtime' },
  { pattern: /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/i, key: 'browserStorage' },
  { pattern: /\bnavigator\.(geolocation|mediaDevices|clipboard|permissions)\b/i, key: 'permission' },
  { pattern: /\b(getUserMedia|Notification\.requestPermission)\b/i, key: 'devicePermission' },
  { pattern: /\b(serviceWorker|Worker|SharedWorker|importScripts)\b/i, key: 'worker' },
  { pattern: /\bpostMessage\s*\(/i, key: 'postMessage' },
  { pattern: /\b(?:https?:|wss?:|ftp:|file:|data:|blob:|mailto:|tel:|sms:)/i, key: 'url' },
  { pattern: /(^|["'(\s])\/\//i, key: 'protocolRelative' },
];

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  const form = await request.formData().catch(() => null);
  if (!form) return errorResponse(request, env, submissionMessages['zh-TW'].invalidForm, 400);
  const locale = getLocale(form);
  const copy = submissionMessages[locale];

  if (cleanText(form.get('website'), 80)) {
    return jsonResponse(request, env, { ok: true, ignored: true });
  }

  const type = cleanText(form.get('type'), 16);
  const title = cleanText(form.get('title'), MAX_TITLE_LENGTH);
  const name = cleanText(form.get('name'), MAX_NAME_LENGTH);
  const contact = cleanText(form.get('contact'), MAX_CONTACT_LENGTH);

  if (!['idea', 'demo'].includes(type)) return errorResponse(request, env, copy.invalidType, 400);
  if (!title) return errorResponse(request, env, copy.titleRequired, 400);

  if (type === 'idea') {
    const ideaText = cleanText(form.get('ideaText'), MAX_IDEA_LENGTH);
    if (ideaText.length < 20) return errorResponse(request, env, copy.ideaTooShort, 400);

    const txt = buildIdeaText({ title, name, contact, ideaText });
    const sendResult = await trySendDiscord(env, {
      content: buildDiscordContent({
        heading: 'Rehab Trainer Hub 活動想法投稿',
        title,
        name,
        contact,
        summary: ideaText,
      }),
      attachment: {
        filename: `${safeFileBase(title)}-idea.txt`,
        contentType: 'text/plain;charset=utf-8',
        body: txt,
      },
    }, copy.webhookMissing);
    if (!sendResult.ok) return errorResponse(request, env, sendResult.message, 502);

    return jsonResponse(request, env, { ok: true });
  }

  const description = cleanText(form.get('description'), MAX_DESCRIPTION_LENGTH);
  if (description.length < 20) return errorResponse(request, env, copy.descriptionTooShort, 400);

  const file = form.get('demoFile');
  if (!isUploadedFile(file)) return errorResponse(request, env, copy.fileRequired, 400);
  if (!file.name.toLowerCase().endsWith('.html')) return errorResponse(request, env, copy.fileType, 400);
  if (!file.size || file.size > MAX_HTML_BYTES) return errorResponse(request, env, copy.fileSize, 400);

  const html = await file.text();
  const scan = scanHtml(html, locale);
  if (!scan.ok) {
    return jsonResponse(request, env, {
      error: copy.htmlFailed,
      details: scan.messages,
    }, { status: 400 });
  }

  const sendResult = await trySendDiscord(env, {
    content: buildDiscordContent({
      heading: 'Rehab Trainer Hub HTML Demo 投稿',
      title,
      name,
      contact,
      summary: description,
      scanSummary: copy.scanPassed(file.size),
    }),
    attachment: {
      filename: `${safeFileBase(title)}.html`,
      contentType: 'text/html;charset=utf-8',
      body: html,
    },
  }, copy.webhookMissing);
  if (!sendResult.ok) return errorResponse(request, env, sendResult.message, 502);

  return jsonResponse(request, env, { ok: true, scan });
}

export function scanHtml(html, locale = 'zh-TW') {
  const copy = submissionMessages[locale] || submissionMessages['zh-TW'];
  const messages = [];
  if (!html || !html.trim()) messages.push(copy.emptyHtml);
  if (!/<!doctype\s+html|<html[\s>]/i.test(html)) messages.push(copy.missingHtmlStructure);

  for (const rule of forbiddenHtmlPatterns) {
    if (rule.pattern.test(html)) messages.push(copy.forbidden[rule.key]);
  }

  return {
    ok: messages.length === 0,
    messages: Array.from(new Set(messages)).slice(0, 10),
  };
}

function getLocale(form) {
  return cleanText(form.get('locale'), 16) === 'en' ? 'en' : 'zh-TW';
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

function isUploadedFile(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.name === 'string' &&
    typeof value.size === 'number' &&
    typeof value.text === 'function',
  );
}

function buildIdeaText({ title, name, contact, ideaText }) {
  return [
    `標題：${title}`,
    `姓名或單位：${name || '未提供'}`,
    `聯絡方式：${contact || '未提供'}`,
    '',
    '活動想法：',
    ideaText,
  ].join('\n');
}

function buildDiscordContent({ heading, title, name, contact, summary, scanSummary }) {
  const lines = [
    `**${escapeDiscord(heading)}**`,
    `標題：${escapeDiscord(title)}`,
    `姓名或單位：${escapeDiscord(name || '未提供')}`,
    `聯絡方式：${escapeDiscord(contact || '未提供')}`,
  ];

  if (scanSummary) lines.push(`檢查：${escapeDiscord(scanSummary)}`);
  lines.push('', escapeDiscord(summary).slice(0, 900));
  return lines.join('\n').slice(0, 1900);
}

async function sendDiscordSubmission(env, { content, attachment }) {
  const webhookUrl = getWebhookUrl(env);
  if (!webhookUrl) throw new Error(`${WEBHOOK_ENV_NAME} is not configured.`);

  const body = new FormData();
  body.append('payload_json', JSON.stringify({
    content,
    allowed_mentions: { parse: [] },
  }));
  body.append(
    'files[0]',
    new Blob([attachment.body], { type: attachment.contentType }),
    attachment.filename,
  );

  const response = await fetch(webhookUrl, {
    method: 'POST',
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Discord webhook failed: ${response.status} ${errorText.slice(0, 200)}`);
  }
}

async function trySendDiscord(env, payload, errorMessage = submissionMessages['zh-TW'].webhookMissing) {
  try {
    await sendDiscordSubmission(env, payload);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: errorMessage,
    };
  }
}

function getWebhookUrl(env) {
  const rawUrl = env[WEBHOOK_ENV_NAME];
  if (!rawUrl) return '';

  try {
    const url = new URL(rawUrl);
    const isDiscord = url.protocol === 'https:' &&
      ['discord.com', 'discordapp.com'].includes(url.hostname) &&
      url.pathname.startsWith('/api/webhooks/');
    return isDiscord ? url.toString() : '';
  } catch {
    return '';
  }
}

function safeFileBase(value) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || 'rehab-trainer-hub-submission';
}

function escapeDiscord(value) {
  return String(value)
    .replace(/@/g, '@\u200b')
    .replace(/`/g, "'");
}
