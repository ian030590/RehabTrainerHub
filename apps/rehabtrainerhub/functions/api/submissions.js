import { errorResponse, jsonResponse, optionsResponse } from '../_lib/auth.js';

const MAX_TITLE_LENGTH = 80;
const MAX_NAME_LENGTH = 80;
const MAX_CONTACT_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1500;
const MAX_IDEA_LENGTH = 4000;
const MAX_HTML_BYTES = 180 * 1024;
const WEBHOOK_ENV_NAME = 'REHAB_SUBMISSION_WEBHOOK_URL';

const forbiddenHtmlPatterns = [
  { pattern: /<\s*script\b/i, message: '包含 script 標籤' },
  { pattern: /\son[a-z0-9_-]+\s*=/i, message: '包含 inline 事件處理器' },
  { pattern: /javascript\s*:/i, message: '包含 javascript: 連結' },
  { pattern: /<\s*(iframe|object|embed|applet|form)\b/i, message: '包含可送出資料或嵌入外部內容的標籤' },
  { pattern: /\s(formaction|action)\s*=/i, message: '包含表單送出目標' },
  { pattern: /<\s*input\b[^>]*\btype\s*=\s*["']?file/i, message: '包含檔案讀取欄位' },
  { pattern: /<\s*link\b/i, message: '包含外部資源 link 標籤' },
  { pattern: /<\s*base\b/i, message: '包含 base 標籤' },
  { pattern: /<\s*meta\b[^>]*http-equiv\s*=/i, message: '包含 http-equiv meta 標籤' },
  { pattern: /@\s*import\b/i, message: '包含 CSS import' },
  { pattern: /url\s*\(/i, message: '包含 CSS url() 資源' },
  { pattern: /\bfetch\s*\(/i, message: '包含 fetch 連線程式' },
  { pattern: /\bXMLHttpRequest\b/i, message: '包含 XMLHttpRequest 連線程式' },
  { pattern: /\bnavigator\.sendBeacon\b/i, message: '包含 sendBeacon 傳送程式' },
  { pattern: /\b(WebSocket|EventSource|RTCPeerConnection)\b/i, message: '包含即時連線程式' },
  { pattern: /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/i, message: '嘗試讀寫瀏覽器資料' },
  { pattern: /\bnavigator\.(geolocation|mediaDevices|clipboard|permissions)\b/i, message: '嘗試使用瀏覽器權限' },
  { pattern: /\b(getUserMedia|Notification\.requestPermission)\b/i, message: '嘗試取得裝置或通知權限' },
  { pattern: /\b(serviceWorker|Worker|SharedWorker|importScripts)\b/i, message: '包含背景執行程式' },
  { pattern: /\bpostMessage\s*\(/i, message: '包含跨視窗訊息程式' },
  { pattern: /\b(?:https?:|wss?:|ftp:|file:|data:|blob:|mailto:|tel:|sms:)/i, message: '包含外部或特殊網址' },
  { pattern: /(^|["'(\s])\/\//i, message: '包含 protocol-relative URL' },
];

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  const form = await request.formData().catch(() => null);
  if (!form) return errorResponse(request, env, '投稿格式不正確。', 400);

  if (cleanText(form.get('website'), 80)) {
    return jsonResponse(request, env, { ok: true, ignored: true });
  }

  const type = cleanText(form.get('type'), 16);
  const title = cleanText(form.get('title'), MAX_TITLE_LENGTH);
  const name = cleanText(form.get('name'), MAX_NAME_LENGTH);
  const contact = cleanText(form.get('contact'), MAX_CONTACT_LENGTH);

  if (!['idea', 'demo'].includes(type)) return errorResponse(request, env, '投稿類型不正確。', 400);
  if (!title) return errorResponse(request, env, '請填寫標題。', 400);

  if (type === 'idea') {
    const ideaText = cleanText(form.get('ideaText'), MAX_IDEA_LENGTH);
    if (ideaText.length < 20) return errorResponse(request, env, '活動想法至少需要 20 個字。', 400);

    const txt = buildIdeaText({ title, name, contact, ideaText });
    const sendResult = await trySendDiscord(env, {
      content: buildDiscordContent({
        heading: 'RehabTrainerHub 活動想法投稿',
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
    });
    if (!sendResult.ok) return errorResponse(request, env, sendResult.message, 502);

    return jsonResponse(request, env, { ok: true });
  }

  const description = cleanText(form.get('description'), MAX_DESCRIPTION_LENGTH);
  if (description.length < 20) return errorResponse(request, env, 'Demo 說明至少需要 20 個字。', 400);

  const file = form.get('demoFile');
  if (!isUploadedFile(file)) return errorResponse(request, env, '請上傳一個 HTML 檔。', 400);
  if (!file.name.toLowerCase().endsWith('.html')) return errorResponse(request, env, '只接受 .html 檔。', 400);
  if (!file.size || file.size > MAX_HTML_BYTES) return errorResponse(request, env, 'HTML 檔案需小於 180 KB。', 400);

  const html = await file.text();
  const scan = scanHtml(html);
  if (!scan.ok) {
    return jsonResponse(request, env, {
      error: 'HTML 安全檢查未通過。',
      details: scan.messages,
    }, { status: 400 });
  }

  const sendResult = await trySendDiscord(env, {
    content: buildDiscordContent({
      heading: 'RehabTrainerHub HTML Demo 投稿',
      title,
      name,
      contact,
      summary: description,
      scanSummary: `HTML 安全檢查通過。檔案 ${file.size} bytes。`,
    }),
    attachment: {
      filename: `${safeFileBase(title)}.html`,
      contentType: 'text/html;charset=utf-8',
      body: html,
    },
  });
  if (!sendResult.ok) return errorResponse(request, env, sendResult.message, 502);

  return jsonResponse(request, env, { ok: true, scan });
}

export function scanHtml(html) {
  const messages = [];
  if (!html || !html.trim()) messages.push('HTML 內容是空的');
  if (!/<!doctype\s+html|<html[\s>]/i.test(html)) messages.push('缺少基本 HTML 結構');

  for (const rule of forbiddenHtmlPatterns) {
    if (rule.pattern.test(html)) messages.push(rule.message);
  }

  return {
    ok: messages.length === 0,
    messages: Array.from(new Set(messages)).slice(0, 10),
  };
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

async function trySendDiscord(env, payload) {
  try {
    await sendDiscordSubmission(env, payload);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: '投稿尚未送出。請確認 Discord webhook secret 已設定。',
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
  return normalized || 'rehabtrainerhub-submission';
}

function escapeDiscord(value) {
  return String(value)
    .replace(/@/g, '@\u200b')
    .replace(/`/g, "'");
}
