import { isRecord } from '@/core/guards';

/** Marque des fichiers d'export du script : un autre JSON est refusé. */
export const EXPORT_FORMAT = 'wikimasters-memoire';
export const EXPORT_VERSION = 1;

/** Fichier d'export : chaque donnée sous son identifiant (`DataSet.id`), au format de son `dump`. */
export interface ExportFile {
  /** Version du script qui l'a écrit. */
  readonly script: string;
  /** Date de l'export (ms). */
  readonly exportedAt: number;
  readonly data: Readonly<Record<string, unknown>>;
}

/** Le JSON du fichier (date lisible). */
export function exportJson(file: ExportFile) {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    script: file.script,
    exportedAt: new Date(file.exportedAt).toISOString(),
    data: file.data,
  };
}

/** Fichier relu : `undefined` s'il ne vient pas du script. Le contenu de chaque donnée est validé par sa fusion. */
export function parseExport(raw: unknown): ExportFile | undefined {
  if (!isRecord(raw) || raw.format !== EXPORT_FORMAT || !isRecord(raw.data)) return undefined;
  const exportedAt = typeof raw.exportedAt === 'string' ? Date.parse(raw.exportedAt) : NaN;
  return {
    script: typeof raw.script === 'string' ? raw.script : '',
    exportedAt: Number.isFinite(exportedAt) ? exportedAt : 0,
    data: raw.data,
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** « wikimasters-memoire-2026-10-04.json » (jour de l'appareil). */
export function exportFileName(time: number): string {
  const date = new Date(time);
  return `${EXPORT_FORMAT}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
