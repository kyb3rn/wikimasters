import { useState } from 'preact/hooks';
import { RarityFilter, SearchButton } from '@/services/list-search';
import { RARITIES, type Rarity } from '@/site/rarity';
import { buttonClass } from '@/ui/button';
import { tagChipStyle } from '@/site/collection';
import { ChoiceField, Listbox, LoadError, NumberField, Pagination, StepSlider, Switch, type PaginationControl } from '@/ui/controls';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { DEMO_BUSY_MS, Group, Specimen } from './layout';

const DURATIONS = [
  { value: 10, label: '10 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 h' },
  { value: 180, label: '3 h' },
  { value: 360, label: '6 h' },
  { value: 720, label: '12 h' },
];

const SIZES = [
  { value: 50, label: '50 %' },
  { value: 75, label: '75 %' },
  { value: 87.5, label: '87,5 %' },
  { value: 100, label: '100 %' },
  { value: 112.5, label: '112,5 %' },
  { value: 125, label: '125 %' },
  { value: 150, label: '150 %' },
  { value: 200, label: '200 %' },
];

function Toggle({ initial, disabled }: { readonly initial: boolean; readonly disabled?: boolean }) {
  const [on, setOn] = useState(initial);
  return <Switch checked={on} onChange={setOn} label="Interrupteur" disabled={disabled} />;
}

/** Interrupteur du site (visibilité du profil), dans sa pastille. */
function VisibilityPill({ initial, busy }: { readonly initial: boolean; readonly busy?: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy}
      aria-busy={busy}
      class={siteClass.visibilityButton}
      onClick={() => setOn(!on)}
    >
      <Icon name={on ? 'globe' : 'lock'} size={14} busy={busy} />
      <span>{on ? 'Visible de tous' : 'Amis seulement'}</span>
      <span class={`${siteClass.switchTrack} ${on ? siteClass.switchTrackOn : siteClass.switchTrackOff}`} aria-hidden="true">
        <span class={`${siteClass.switchKnob} ${on ? siteClass.switchKnobOn : siteClass.switchKnobOff}`} />
      </span>
    </button>
  );
}

function Rarities({ initial }: { readonly initial: readonly Rarity[] }) {
  const [checked, setChecked] = useState<ReadonlySet<Rarity>>(() => new Set(initial));
  const toggle = (rarity: Rarity) => {
    const next = new Set(checked);
    if (!next.delete(rarity)) next.add(rarity);
    setChecked(next);
  };
  return <RarityFilter rarities={RARITIES} checked={checked} onToggle={toggle} onReset={() => setChecked(new Set())} />;
}

// Dans une fonction : rien au niveau du module qui ne soit pur (la vitrine est retirée du fichier de production).
const tagOptions = () => [
  { value: '', label: 'Toutes les étiquettes' },
  { value: 't1', label: '#rouge (12)', chipStyle: tagChipStyle('#ef4444') },
  { value: 't2', label: '#à échanger (3)', chipStyle: tagChipStyle('#3b82f6') },
];

function DemoListbox({ initial }: { readonly initial: string }) {
  const [value, setValue] = useState(initial);
  return <Listbox ariaLabel="Filtrer par étiquette" value={value} options={tagOptions()} onChange={setValue} class="wm-showcase-listbox" />;
}

/** Chargement en échec : « Réessayer » tourne un moment. */
function DemoLoadError() {
  const [busy, setBusy] = useState(false);
  return (
    <LoadError
      message="Le chargement des cartes a échoué."
      busy={busy}
      onRetry={() => {
        setBusy(true);
        setTimeout(() => setBusy(false), DEMO_BUSY_MS);
      }}
    />
  );
}

/** Pagination qui charge un moment après chaque changement, roue sur le bouton cliqué. */
function DemoPagination({ total }: { readonly total?: number }) {
  const [page, setPage] = useState(3);
  const [busy, setBusy] = useState<PaginationControl | false>(false);
  return (
    <Pagination
      page={page}
      total={total}
      hasNext={total === undefined ? page < 6 : undefined}
      busy={busy}
      onChange={(next, control) => {
        setBusy(control);
        setTimeout(() => {
          setPage(next);
          setBusy(false);
        }, DEMO_BUSY_MS);
      }}
    />
  );
}

export function Fields() {
  const [bid, setBid] = useState(10);
  const [delay, setDelay] = useState(700);
  const [duration, setDuration] = useState(60);
  const [size, setSize] = useState(100);
  const [grid, setGrid] = useState(false);
  const field = `${siteClass.textField} wm-showcase-field`;

  return (
    <>
      <Group title="Texte">
        <Specimen width="18rem">
          <input type="text" class={field} style={{ width: '100%' }} placeholder="Rechercher par nom ou description" />
        </Specimen>
        <Specimen width="18rem">
          <input type="text" class={field} style={{ width: '100%' }} value="Tour Eiffel" />
        </Specimen>
      </Group>

      <Group title="Ligne de filtres">
        <div class="wm-showcase-line">
          <input type="text" class={field} placeholder="Rechercher par nom ou description" />
          <Rarities initial={['SR']} />
          <button type="button" class={buttonClass('square')} aria-label="Gérer les étiquettes">
            <Icon name="settings" size={16} />
          </button>
          <SearchButton status="search" onClick={() => undefined} />
        </div>
      </Group>

      <Group title="Listes déroulantes">
        <DemoListbox initial="" />
        <DemoListbox initial="t1" />
      </Group>

      <Group title="Chargement en échec">
        <Specimen width="28rem">
          <DemoLoadError />
        </Specimen>
      </Group>

      <Group title="Nombre">
        <NumberField value={bid} onChange={setBid} label="Mise de départ" min={1} max={100000} />
        <NumberField value={delay} onChange={setDelay} label="Délai" min={0} max={2000} step={50} unit="ms" />
        <NumberField value={1} onChange={() => undefined} label="Au minimum" min={1} max={10} />
      </Group>

      <Group title="Pastilles">
        <ChoiceField value={duration} options={DURATIONS} onChange={setDuration} label="Durée" />
      </Group>

      <Group title="Choix à icônes">
        <div class={siteClass.segmented} role="radiogroup" aria-label="Affichage des cartes">
          {[false, true].map((option) => (
            <button
              key={String(option)}
              type="button"
              role="radio"
              aria-checked={grid === option}
              aria-label={option ? 'Grille' : 'Carrousel'}
              class={`${siteClass.segment} ${grid === option ? siteClass.segmentActive : siteClass.segmentIdle}`}
              onClick={() => setGrid(option)}
            >
              <Icon name={option ? 'grid' : 'carousel'} size={18} />
            </button>
          ))}
        </div>
      </Group>

      <Group title="Cases de rareté">
        <Rarities initial={['SR', 'R']} />
        <Rarities initial={RARITIES} />
        <Rarities initial={[]} />
      </Group>

      <Group title="Interrupteurs">
        <Toggle initial />
        <Toggle initial={false} />
        <Toggle initial disabled />
        <VisibilityPill initial />
        <VisibilityPill initial={false} />
        <VisibilityPill initial busy />
      </Group>

      <Group title="Curseur cranté">
        <Specimen width="34rem">
          <StepSlider value={size} options={SIZES} onChange={setSize} label="Taille des cartes" />
        </Specimen>
        <Specimen width="34rem">
          <StepSlider value={100} options={SIZES} onChange={() => undefined} label="Taille des cartes" disabled />
        </Specimen>
      </Group>

      <Group title="Pagination">
        <DemoPagination total={12} />
        <DemoPagination />
        <Pagination page={3} total={12} lockedReason="Lancer la recherche d’abord" onChange={() => undefined} />
      </Group>
    </>
  );
}
