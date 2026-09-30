import { isRecord } from '@/core/guards';
import { SiteApiError } from './request';
import { supabaseRequest } from './supabase';

/**
 * Étiquettes (code du site, 29/09/2026) : table `tags` (`id`, `user_id`, `name` de 48 caractères au plus,
 * `color` `#rrggbb`, nom unique par joueur : `23505` sinon) et associations `user_card_tags`
 * (`user_card_id`, `tag_id`). Le site ajoute par `upsert` en ignorant les doublons, retire par `delete`.
 */
export interface SiteTag {
  readonly id: string;
  readonly name: string;
  readonly color: string | undefined;
}

export interface NewTag {
  readonly name: string;
  readonly color: string;
}

function parseTags(raw: unknown): SiteTag[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const tags: SiteTag[] = [];
  for (const row of raw) {
    if (!isRecord(row) || typeof row.id !== 'string' || typeof row.name !== 'string') return undefined;
    tags.push({ id: row.id, name: row.name, color: typeof row.color === 'string' ? row.color : undefined });
  }
  return tags;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Crée des étiquettes en une requête. Une qui existe déjà (créée ailleurs entre-temps : `23505`, rien
 * n'est alors créé) est reprise par son nom, comme le fait le site, et seules les autres sont créées.
 */
export async function createTags(userId: string, tags: readonly NewTag[]): Promise<SiteTag[]> {
  const insert = (list: readonly NewTag[]) =>
    supabaseRequest(
      '/rest/v1/tags?select=*',
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify(list.map(({ name, color }) => ({ user_id: userId, name: name.trim(), color }))),
      },
      "Impossible de créer l'étiquette",
      parseTags,
    );
  try {
    return await insert(tags);
  } catch (error) {
    if (!(error instanceof SiteApiError) || error.code !== '23505') throw error;
  }
  const existing = await supabaseRequest(
    `/rest/v1/tags?select=*&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'GET' },
    'Impossible de lire les étiquettes',
    parseTags,
  );
  const found = tags.flatMap((tag) => existing.filter((row) => sameName(row.name, tag.name)).slice(0, 1));
  const missing = tags.filter((tag) => !existing.some((row) => sameName(row.name, tag.name)));
  const created = missing.length > 0 ? await insert(missing) : [];
  return [...found, ...created];
}

const inList = (ids: readonly string[]) => `in.(${ids.map(encodeURIComponent).join(',')})`;

/** Pose chaque étiquette sur chaque exemplaire, en une requête ; celles déjà posées sont ignorées. */
export async function addTagsToCards(userCardIds: readonly string[], tagIds: readonly string[]): Promise<void> {
  const rows = userCardIds.flatMap((user_card_id) => tagIds.map((tag_id) => ({ user_card_id, tag_id })));
  await supabaseRequest(
    '/rest/v1/user_card_tags?on_conflict=user_card_id,tag_id',
    { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows) },
    "Impossible d'appliquer les étiquettes",
    () => true,
  );
}

/** Retire ces étiquettes de ces exemplaires, en une requête (celles qu'ils n'ont pas sont ignorées). */
export async function removeTagsFromCards(userCardIds: readonly string[], tagIds: readonly string[]): Promise<void> {
  await supabaseRequest(
    `/rest/v1/user_card_tags?tag_id=${inList(tagIds)}&user_card_id=${inList(userCardIds)}`,
    { method: 'DELETE', headers: { prefer: 'return=minimal' } },
    'Impossible de retirer les étiquettes',
    () => true,
  );
}
