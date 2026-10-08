import drawingDefenseCatalog from '../../games/drawing-defense/public/game.json' with { type: 'json' };
import { maxGameCatalogBytes, ParseGameCatalogMetadata } from '../../games/gameCatalogMetadata.js';
import { PackageKey } from '../../../usergamerunner/functions/_lib/release.js';

const compatibleCatalogs = { 'drawing-defense': drawingDefenseCatalog };

export async function ReadReleasedGameCatalog(bucket, release) {
  const file = release.files.find(entry => entry.path === 'game.json');
  if (!file) {
    const metadata = compatibleCatalogs[release.gameId];
    return metadata ? { metadata, preview: null } : null;
  }
  if (file.size > maxGameCatalogBytes) return null;
  const object = await bucket.get(PackageKey(release.gameId, release.version, file.path));
  if (!object || object.size !== file.size) return null;
  const bytes = await object.arrayBuffer();
  if (bytes.byteLength !== file.size) return null;
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    value => value.toString(16).padStart(2, '0')).join('');
  if (digest !== file.sha256) return null;
  try {
    const metadata = ParseGameCatalogMetadata(JSON.parse(new TextDecoder().decode(bytes)), release.gameId, release.fileByPath);
    return { metadata, preview: metadata.preview };
  } catch { return null; }
}
