import assert from 'node:assert/strict';
import {
  CreateSignedValue,
  authCookieName,
} from '../../_lib/auth.js';
import {
  onRequestGet as getArticles,
  onRequestPost as createArticle,
} from './articles.js';
import {
  onRequestDelete as deleteArticle,
  onRequestGet as getArticle,
  onRequestPut as updateArticle,
} from './articles/[id].js';

const secret = '0123456789abcdef0123456789abcdef';
const staff = {
  id: 'therapist-1',
  display_name: 'Therapist One',
  email: 'therapist@example.test',
  role: 'therapist',
};
const patient = {
  id: 'patient-1',
  display_name: 'Patient One',
  email: 'patient@example.test',
  role: 'patient',
};
const database = CreateArticleDb([staff, patient]);
let cacheInvalidations = 0;
const env = {
  AUTH_SESSION_SECRET: secret,
  REHAB_DB: database,
  ARTICLE_CACHE: {
    async get() {
      return null;
    },
    async put() {},
    async delete() {
      cacheInvalidations += 1;
    },
  },
};
const staffToken = await CreateSignedValue({ sub: staff.id }, secret, 60);
const patientToken = await CreateSignedValue({ sub: patient.id }, secret, 60);

const oversizedCreate = await createArticle({
  request: new Request('https://trainerhub.cc/api/admin/articles', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Cookie: `${authCookieName}=${encodeURIComponent(staffToken)}`,
      'Content-Type': 'application/json',
      'Content-Length': String(128 * 1024 + 1),
    },
    body: '{}',
  }),
  env,
});
assert.equal(oversizedCreate.status, 413);

const deniedCreate = await createArticle({
  request: JsonRequest(
    'https://trainerhub.cc/api/admin/articles',
    patientToken,
    { title: 'Denied', content: 'Denied', status: 'draft' },
  ),
  env,
});
assert.equal(deniedCreate.status, 403);

const createResponse = await createArticle({
  request: JsonRequest(
    'https://trainerhub.cc/api/admin/articles',
    staffToken,
    {
      slug: 'safe-home-training',
      title: 'Safe home training',
      summary: 'Prepare a safe space.',
      content: 'Long-form education content.',
      category: 'Safety',
      status: 'published',
    },
  ),
  env,
});
assert.equal(createResponse.status, 201);
const created = (await createResponse.json()).article;
assert.equal(created.slug, 'safe-home-training');
assert.equal(created.status, 'published');
assert.equal(created.authorName, 'Therapist One');
assert.equal(database.auditEvents.length, 1);
assert.equal(database.auditEvents[0].action, 'education_article.create');
assert.deepEqual(JSON.parse(database.auditEvents[0].metadata_json), {
  slug: 'safe-home-training',
  status: 'published',
});
assert.equal(database.auditEvents[0].metadata_json.includes('Long-form'), false);

const listResponse = await getArticles({
  request: StaffRequest('https://trainerhub.cc/api/admin/articles', staffToken),
  env,
});
assert.equal(listResponse.status, 200);
const listedArticles = (await listResponse.json()).articles;
assert.equal(listedArticles.length, 1);
assert.equal('content' in listedArticles[0], false);

const detailResponse = await getArticle({
  request: StaffRequest(
    `https://trainerhub.cc/api/admin/articles/${created.id}`,
    staffToken,
  ),
  env,
  params: { id: created.id },
});
assert.equal(detailResponse.status, 200);
assert.equal((await detailResponse.json()).article.content, 'Long-form education content.');

const updateResponse = await updateArticle({
  request: JsonRequest(
    `https://trainerhub.cc/api/admin/articles/${created.id}`,
    staffToken,
    { status: 'draft' },
    'PUT',
  ),
  env,
  params: { id: created.id },
});
assert.equal(updateResponse.status, 200);
const updated = (await updateResponse.json()).article;
assert.equal(updated.status, 'draft');
assert.equal(updated.publishedAt, null);
assert.equal(database.auditEvents[1].action, 'education_article.update');

const deleteResponse = await deleteArticle({
  request: StaffRequest(
    `https://trainerhub.cc/api/admin/articles/${created.id}`,
    staffToken,
    'DELETE',
  ),
  env,
  params: { id: created.id },
});
assert.equal(deleteResponse.status, 200);
assert.deepEqual(await deleteResponse.json(), { ok: true });
assert.equal(database.auditEvents[2].action, 'education_article.delete');
assert.equal(database.articles.size, 0);
assert.equal(cacheInvalidations, 6);

console.log('admin article security checks passed');

function StaffRequest(url, token, method = 'GET') {
  return new Request(url, {
    method,
    headers: {
      Origin: 'https://trainerhub.cc',
      Cookie: `${authCookieName}=${encodeURIComponent(token)}`,
    },
  });
}

function JsonRequest(url, token, body, method = 'POST') {
  return new Request(url, {
    method,
    headers: {
      Origin: 'https://trainerhub.cc',
      Cookie: `${authCookieName}=${encodeURIComponent(token)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function CreateArticleDb(userRows) {
  const users = new Map(userRows.map((user) => [user.id, user]));
  const articles = new Map();
  const auditEvents = [];

  function Prepare(sql, args = []) {
    const statement = {
      sql,
      args,
      bind(...nextArgs) {
        return Prepare(sql, nextArgs);
      },
      async first() {
        if (/SELECT id, display_name, email, avatar_url, role\s+FROM app_users/i.test(sql)) {
          return users.get(args[0]) || null;
        }
        if (/FROM education_articles[\s\S]*WHERE education_articles\.id = \?/i.test(sql)) {
          return ToArticleRow(articles.get(args[0]), users);
        }
        return null;
      },
      async all() {
        if (/FROM education_articles/i.test(sql)) {
          return {
            results: Array.from(articles.values()).map((article) => ToArticleRow(article, users)),
          };
        }
        return { results: [] };
      },
      async run() {
        ExecuteMutation(statement);
        return { success: true, meta: { changes: 1 } };
      },
    };
    return statement;
  }

  function ExecuteMutation(statement) {
    const { sql, args } = statement;
    if (/INSERT INTO education_articles/i.test(sql)) {
      const [
        id,
        slug,
        title,
        summary,
        content,
        category,
        coverImageUrl,
        status,
        authorUserId,
        publishedAt,
        createdAt,
        updatedAt,
      ] = args;
      articles.set(id, {
        id,
        slug,
        title,
        summary,
        content,
        category,
        cover_image_url: coverImageUrl,
        status,
        author_user_id: authorUserId,
        published_at: publishedAt,
        created_at: createdAt,
        updated_at: updatedAt,
      });
      return;
    }
    if (/UPDATE education_articles/i.test(sql)) {
      const [
        slug,
        title,
        summary,
        content,
        category,
        coverImageUrl,
        status,
        publishedAt,
        updatedAt,
        id,
      ] = args;
      const current = articles.get(id);
      articles.set(id, {
        ...current,
        slug,
        title,
        summary,
        content,
        category,
        cover_image_url: coverImageUrl,
        status,
        published_at: publishedAt,
        updated_at: updatedAt,
      });
      return;
    }
    if (/DELETE FROM education_articles/i.test(sql)) {
      articles.delete(args[0]);
      return;
    }
    if (/INSERT INTO admin_audit_events/i.test(sql)) {
      const [id, actorUserId, action, targetType, targetId, metadataJson, createdAt] = args;
      auditEvents.push({
        id,
        actor_user_id: actorUserId,
        action,
        target_type: targetType,
        target_id: targetId,
        metadata_json: metadataJson,
        created_at: createdAt,
      });
    }
  }

  return {
    articles,
    auditEvents,
    prepare: Prepare,
    async batch(statements) {
      statements.forEach(ExecuteMutation);
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
}

function ToArticleRow(article, users) {
  if (!article) return null;
  const author = users.get(article.author_user_id);
  return {
    ...article,
    author_name: author?.display_name || author?.email || 'Rehab Trainer Hub',
  };
}
