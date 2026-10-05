import { exportJson, type DataSet, type ExportFile, type ImportCounts } from '@/core/data';

/** Ce qu'un fichier apporte pour une de ses données. */
export interface ImportRow {
  /** Identifiant de la donnée dans le fichier. */
  readonly id: string;
  /** La donnée d'ici ; absente : inconnue de cette version (ignorée). */
  readonly set: DataSet | undefined;
  /** Ce que la fusion ajouterait ou changerait ; `undefined` : contenu illisible. */
  readonly counts: ImportCounts | undefined;
}

/** Le fichier d'export de ces données (contenu de chacune, dans l'ordre). */
export async function buildExport(sets: readonly DataSet[], exportedAt: number, script: string) {
  const data: Record<string, unknown> = {};
  for (const set of sets) if (set.transfer) data[set.id] = await set.transfer.dump();
  return exportJson({ script, exportedAt, data });
}

/** Aperçu d'un import : pour chaque donnée du fichier, ce que sa fusion donnerait, sans rien écrire. */
export async function planImport(file: ExportFile, sets: readonly DataSet[]): Promise<ImportRow[]> {
  const rows: ImportRow[] = [];
  for (const [id, raw] of Object.entries(file.data)) {
    const set = sets.find((candidate) => candidate.id === id && candidate.transfer);
    rows.push({ id, set, counts: set?.transfer ? await set.transfer.merge(raw, false) : undefined });
  }
  return rows;
}

/** Fusionne les données choisies du fichier ; rend ce que chacune a ajouté ou changé. */
export async function applyImport(file: ExportFile, sets: readonly DataSet[]): Promise<ImportCounts[]> {
  const results: ImportCounts[] = [];
  for (const set of sets) {
    const counts = set.transfer && (await set.transfer.merge(file.data[set.id], true));
    if (counts) results.push(counts);
  }
  return results;
}
