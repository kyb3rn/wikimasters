import { useMemo, useState } from 'preact/hooks';
import { exportFileName, type DataSet } from '@/core/data';
import { downloadJson } from '@/core/file';
import type { Logger } from '@/core/log';
import type { FeatureCatalog } from '@/core/runtime';
import { Modal, SideTabs } from '@/ui/modal';
import { toast } from '@/ui/toast';
import { DataTab } from './DataTab';
import { useDataLists } from './lists';
import { Overview } from './Overview';
import { MEMORY_TABS, memorySets, memoryTabs, OVERVIEW } from './tabs';
import { buildExport } from './transfer';

export interface MemoryPanelProps {
  readonly catalog: FeatureCatalog;
  readonly log: Logger;
  /** Ferme les confirmations ouvertes avec la fenêtre. */
  readonly signal: AbortSignal;
  readonly onClose: () => void;
}

/** Fenêtre Mémoire : un onglet par type de donnée, « Vue d'ensemble » (contenu, export, import) en tête. */
export function MemoryPanel({ catalog, log, signal, onClose }: MemoryPanelProps) {
  const sets = useMemo(() => memorySets(catalog), [catalog]);
  const tabs = memoryTabs(sets);
  const lists = useDataLists(sets, log);
  const [current, setCurrent] = useState(OVERVIEW);
  const [busy, setBusy] = useState(false);
  const tab = tabs.includes(current) ? current : OVERVIEW;

  async function exportSets(chosen: readonly DataSet[]): Promise<void> {
    const now = Date.now();
    try {
      downloadJson(exportFileName(now), await buildExport(chosen, now, __VERSION__));
    } catch (error) {
      log.warn('export impossible', error);
      toast.error("L'export n'a pas pu se faire.", { title: 'Export' });
    }
  }

  return (
    <Modal title="Mémoire" onClose={onClose} width={1400} height={950} locked={busy}>
      <SideTabs label="Données" tabs={tabs.map((label) => ({ label, icon: MEMORY_TABS[label] }))} current={tab} onSelect={setCurrent}>
        {tab === OVERVIEW ? (
          <Overview sets={sets} lists={lists} log={log} onOpenTab={setCurrent} onExport={exportSets} onBusy={setBusy} />
        ) : (
          <DataTab key={tab} sets={sets.filter((set) => set.tab === tab)} lists={lists} signal={signal} onExport={exportSets} />
        )}
      </SideTabs>
    </Modal>
  );
}
