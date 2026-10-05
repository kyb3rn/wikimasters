import { useState } from 'preact/hooks';
import { parseExport, type DataSet, type ExportFile } from '@/core/data';
import { chooseFile } from '@/core/file';
import { parseJson } from '@/core/guards';
import type { Logger } from '@/core/log';
import { ageText, formatTime } from '@/services/market';
import { notify } from '@/services/notifications';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { toast } from '@/ui/toast';
import { addCounts, formatBytes, importSummary, itemsLabel, totalOf } from './list';
import type { DataLists } from './lists';
import { memoryTabs } from './tabs';
import { applyImport, planImport, type ImportRow } from './transfer';

const NOT_AN_EXPORT = "Ce fichier n'est pas un export de la Mémoire de WikiMasters.";

export interface OverviewProps {
  readonly sets: readonly DataSet[];
  readonly lists: DataLists;
  readonly log: Logger;
  readonly onOpenTab: (tab: string) => void;
  readonly onExport: (sets: readonly DataSet[]) => Promise<void>;
  /** Import en cours : la fenêtre ne se ferme pas. */
  readonly onBusy: (busy: boolean) => void;
}

interface Plan {
  readonly file: ExportFile;
  readonly rows: readonly ImportRow[];
}

const importable = (row: ImportRow) => row.set !== undefined && row.counts !== undefined;

/** Premier onglet : ce que contient chaque donnée, puis l'export et l'import. */
export function Overview({ sets, lists, log, onOpenTab, onExport, onBusy }: OverviewProps) {
  const ordered = memoryTabs(sets).flatMap((tab) => sets.filter((set) => set.tab === tab));
  const transferable = ordered.filter((set) => set.transfer);
  const [toExport, setToExport] = useState<ReadonlySet<string>>(() => new Set(transferable.map((set) => set.id)));
  const [exporting, setExporting] = useState(false);
  const [reading, setReading] = useState(false);
  const [plan, setPlan] = useState<Plan>();
  const [toImport, setToImport] = useState<ReadonlySet<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const total = totalOf(sets.flatMap((set) => lists.state(set.id).items ?? []));

  const flip = (current: ReadonlySet<string>, id: string, on: boolean) => {
    const next = new Set(current);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  async function read(): Promise<void> {
    // Dans le clic : le navigateur n'ouvre le sélecteur que pendant un geste de l'utilisateur.
    const picked = await chooseFile('.json,application/json');
    if (!picked) return;
    setReading(true);
    try {
      const file = parseExport(parseJson(await picked.text()));
      if (!file) {
        toast.error(NOT_AN_EXPORT, { title: 'Import' });
        return;
      }
      const rows = await planImport(file, sets);
      setPlan({ file, rows });
      setToImport(new Set(rows.filter((row) => importable(row) && (row.counts?.added ?? 0) + (row.counts?.updated ?? 0) > 0).map((row) => row.id)));
    } catch (error) {
      log.warn('fichier illisible', error);
      toast.error("Le fichier n'a pas pu être lu.", { title: 'Import' });
    } finally {
      setReading(false);
    }
  }

  async function apply(current: Plan): Promise<void> {
    const targets = current.rows.flatMap((row) => (row.set && toImport.has(row.id) ? [row.set] : []));
    setImporting(true);
    onBusy(true);
    try {
      const results = await applyImport(current.file, targets);
      await lists.reload(targets);
      notify({ title: 'Mémoire', message: `Import terminé : ${importSummary(addCounts(results))}.` });
      setPlan(undefined);
    } catch (error) {
      log.warn('import interrompu', error);
      toast.error("L'import n'a pas pu se terminer : une partie des données a pu être écrite.", { title: 'Import' });
    } finally {
      setImporting(false);
      onBusy(false);
    }
  }

  return (
    <>
      <section class="wm-memory-section">
        <header class="wm-memory-head">
          <div>
            <h3 class="wm-memory-heading">Contenu</h3>
            <p class="wm-memory-text">Ce que le script garde dans ce navigateur : {formatBytes(total.bytes)} en tout.</p>
          </div>
        </header>
        <ul class="wm-memory-list">
          {ordered.map((set) => {
            const state = lists.state(set.id);
            const sum = state.items && totalOf(state.items);
            return (
              <li key={set.id} class="wm-memory-row" data-set={set.id}>
                <div class="wm-memory-main">
                  <button type="button" class="wm-memory-open" title={set.description} onClick={() => onOpenTab(set.tab)}>
                    {set.name}
                  </button>
                </div>
                <span class="wm-memory-count">{sum ? itemsLabel(sum.count) : state.failed ? 'Illisible' : '…'}</span>
                <span class="wm-memory-date">{sum?.latest === undefined ? '—' : ageText(sum.latest)}</span>
                <span class="wm-memory-size">{sum ? formatBytes(sum.bytes) : ''}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section class="wm-memory-section">
        <header class="wm-memory-head">
          <div>
            <h3 class="wm-memory-heading">Exporter</h3>
            <p class="wm-memory-text">Enregistre ces données dans un fichier, à importer dans un autre navigateur.</p>
          </div>
        </header>
        <div class="wm-memory-block">
          {transferable.map((set) => {
            const sum = totalOf(lists.state(set.id).items ?? []);
            return (
              <label key={set.id} class="wm-memory-choice">
                <input
                  type="checkbox"
                  class="wm-memory-check"
                  checked={toExport.has(set.id)}
                  onChange={(event) => setToExport((current) => flip(current, set.id, event.currentTarget.checked))}
                />
                <span class="wm-memory-choice-name">{set.name}</span>
                <span class="wm-memory-choice-note">
                  {itemsLabel(sum.count)} · {formatBytes(sum.bytes)}
                </span>
              </label>
            );
          })}
          <div class="wm-memory-buttons">
            <button
              type="button"
              class={buttonClass('standard', { tone: 'accent', fill: 'solid' })}
              disabled={exporting || toExport.size === 0}
              aria-busy={exporting}
              onClick={() => {
                setExporting(true);
                void onExport(transferable.filter((set) => toExport.has(set.id))).finally(() => setExporting(false));
              }}
            >
              <Icon name="download" size={16} busy={exporting} />
              Exporter
            </button>
          </div>
        </div>
      </section>

      <section class="wm-memory-section">
        <header class="wm-memory-head">
          <div>
            <h3 class="wm-memory-heading">Importer</h3>
            <p class="wm-memory-text">
              Reprend un fichier exporté : ce qui manque ici est ajouté, et la version la plus récente de chaque élément l'emporte.
              Rien n'est supprimé.
            </p>
          </div>
        </header>
        <div class="wm-memory-block">
          {!plan ? (
            <div class="wm-memory-buttons">
              <button
                type="button"
                class={buttonClass('standard')}
                disabled={reading}
                aria-busy={reading}
                onClick={() => void read()}
              >
                <Icon name="upload" size={16} busy={reading} />
                Choisir un fichier
              </button>
            </div>
          ) : (
            <>
              <p class="wm-memory-file">
                Fichier exporté
                {plan.file.exportedAt > 0 && ` le ${new Date(plan.file.exportedAt).toLocaleDateString('fr-FR')} à ${formatTime(plan.file.exportedAt)}`}
                {plan.file.script && ` (version ${plan.file.script})`}.
              </p>
              {plan.rows.length === 0 && <p class="wm-memory-file">Il ne contient aucune donnée.</p>}
              {plan.rows.map((row) => (
                <label key={row.id} class="wm-memory-choice" data-disabled={importable(row) ? undefined : ''}>
                  <input
                    type="checkbox"
                    class="wm-memory-check"
                    checked={toImport.has(row.id)}
                    disabled={!importable(row) || importing}
                    onChange={(event) => setToImport((current) => flip(current, row.id, event.currentTarget.checked))}
                  />
                  <span class="wm-memory-choice-name">{row.set?.name ?? row.id}</span>
                  <span class="wm-memory-choice-note">
                    {!row.set ? 'Inconnue de cette version : ignorée' : row.counts ? importSummary(row.counts) : 'Contenu illisible'}
                  </span>
                </label>
              ))}
              <div class="wm-memory-buttons">
                <button type="button" class={buttonClass('standard')} disabled={importing} onClick={() => setPlan(undefined)}>
                  Annuler
                </button>
                <button
                  type="button"
                  class={buttonClass('standard', { tone: 'accent', fill: 'solid' })}
                  disabled={importing || toImport.size === 0}
                  aria-busy={importing}
                  onClick={() => void apply(plan)}
                >
                  <Icon name="upload" size={16} busy={importing} />
                  Importer
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
