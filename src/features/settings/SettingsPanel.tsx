import { useEffect, useState } from 'preact/hooks';
import type { FeatureCatalog, FeatureEntry } from '@/core/runtime';
import { onSettingsChange, type SettingDefinition, type Settings } from '@/core/settings';
import { jsonStore } from '@/core/storage';
import { ChoiceField, NumberField, StepSlider, Switch } from '@/ui/controls';
import { Icon } from '@/ui/icons';
import { Modal } from '@/ui/modal';
import { ABOUT, orderTabs, TAB_ICONS } from './tabs';

/** Dernier onglet ouvert, rouvert à la prochaine ouverture (même après un rechargement). */
const lastTab = jsonStore<string | undefined>('wm-settings-tab-v1', undefined, (raw) =>
  typeof raw === 'string' ? raw : undefined,
);

export interface SettingsPanelProps {
  readonly catalog: FeatureCatalog;
  readonly onClose: () => void;
}

/** Fenêtre de paramètres : catégories à gauche, réglages de la catégorie à droite, « À propos » en dernier. */
export function SettingsPanel({ catalog, onClose }: SettingsPanelProps) {
  const [, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => setRevision((n) => n + 1);
    catalog.onChange(refresh, { signal: controller.signal });
    onSettingsChange(refresh, { signal: controller.signal });
    return () => controller.abort();
  }, [catalog]);

  const entries = catalog.list().filter((entry) => !entry.feature.hidden);
  const tabs = orderTabs(entries.map((entry) => entry.feature.category));
  const [selected, setSelected] = useState(() => lastTab.get());
  // Onglet retenu disparu (catégorie supprimée, « Développement » hors dev) : le premier.
  const current = selected !== undefined && tabs.includes(selected) ? selected : (tabs[0] ?? ABOUT);
  const select = (tab: string) => {
    setSelected(tab);
    lastTab.set(tab);
  };

  return (
    <Modal title="Paramètres" onClose={onClose} width={960} height={620}>
      <nav class="wm-settings-nav" aria-label="Catégories">
        {tabs.map((tab) => {
          const icon = TAB_ICONS[tab];
          return (
            <button
              key={tab}
              type="button"
              class="wm-settings-tab"
              data-about={tab === ABOUT ? '' : undefined}
              aria-current={tab === current ? 'page' : undefined}
              onClick={() => select(tab)}
            >
              {icon && <Icon name={icon} size={18} />}
              {tab}
            </button>
          );
        })}
      </nav>
      <section class="wm-settings-content">
        {current === ABOUT ? (
          <div class="wm-settings-section">
            <h3 class="wm-settings-heading">{ABOUT}</h3>
            <About />
          </div>
        ) : (
          sectionsOf(entries.filter((entry) => entry.feature.category === current)).map(([name, group]) => (
            <div key={name} class="wm-settings-section">
              <h3 class="wm-settings-heading">{name}</h3>
              {group.map((entry) => (
                <FeatureSettings key={entry.feature.id} entry={entry} catalog={catalog} />
              ))}
            </div>
          ))
        )}
      </section>
    </Modal>
  );
}

/** Une section par concept : les fonctionnalités de même nom la partagent, au rang de la première d'entre elles. */
function sectionsOf(entries: readonly FeatureEntry[]): [string, FeatureEntry[]][] {
  const sections = new Map<string, FeatureEntry[]>();
  for (const entry of entries) {
    const group = sections.get(entry.feature.name);
    if (group) group.push(entry);
    else sections.set(entry.feature.name, [entry]);
  }
  return [...sections];
}

function About() {
  return (
    <div class="wm-settings-about">
      <p>
        WikiMasters ajoute au site des outils pour jouer plus vite et plus sereinement. Chaque outil s'active ou se
        désactive dans ces paramètres, conservés dans ce navigateur.
      </p>
      <p class="wm-settings-version">
        Version {__VERSION__}
        {__DEV__ && ' (dev)'}
      </p>
    </div>
  );
}

/**
 * Une fonctionnalité : interrupteur et réglages principaux (`primary`) en haut,
 * autres réglages sous un trait. Fonctionnalité éteinte : ses réglages sont estompés et désactivés.
 */
function FeatureSettings({ entry, catalog }: { entry: FeatureEntry; catalog: FeatureCatalog }) {
  const { feature, enabled, state, error } = entry;
  // Sans interrupteur ni libellé propre, le nom ferait doublon avec le titre de la section.
  const label = feature.toggleLabel ?? (feature.required ? undefined : feature.name);
  const settings = feature.settings;
  const definitions = settings ? Object.entries(settings.schema) : [];
  // Fonctionnalité obligatoire sans libellé ni description (réglages seuls) : pas de ligne d'en-tête vide, son premier
  // réglage principal en tient lieu et en prend l'allure.
  const head = label || feature.description || state === 'failed' || !feature.required;
  const rows = (primary: boolean) =>
    settings &&
    definitions
      .filter(([, definition]) => (definition.primary === true) === primary)
      .map(([name, definition], index) => (
        <SettingRow
          key={name}
          settings={settings}
          name={name}
          definition={definition}
          asHead={primary && !head && index === 0}
          disabled={!enabled || (definition.enabledBy !== undefined && settings.get(definition.enabledBy) !== true)}
        />
      ));
  const secondary = rows(false);

  return (
    <article class="wm-settings-feature" data-enabled={enabled}>
      <div class="wm-settings-main">
        {head && (
          <div class="wm-settings-row">
            <div>
              {label && <div class="wm-settings-feature-name">{label}</div>}
              {feature.description && <p class="wm-settings-text">{feature.description}</p>}
              {state === 'failed' && <p class="wm-settings-error">Erreur au démarrage : {error}</p>}
            </div>
            {!feature.required && (
              <Switch
                checked={enabled}
                label={`${feature.name} : ${label ?? feature.name}`}
                onChange={(value) => catalog.setEnabled(feature.id, value)}
              />
            )}
          </div>
        )}
        {rows(true)}
      </div>
      {secondary && secondary.length > 0 && <div class="wm-settings-rows">{secondary}</div>}
    </article>
  );
}

function SettingRow({
  settings,
  name,
  definition,
  asHead = false,
  disabled,
}: {
  settings: Settings;
  name: string;
  definition: SettingDefinition;
  asHead?: boolean;
  /** Fonctionnalité éteinte, ou réglage dont il dépend éteint : il ne se change plus. */
  disabled: boolean;
}) {
  const value = settings.get(name);
  return (
    <div class="wm-settings-row" data-stacked={definition.type === 'choice' || undefined}>
      <div>
        <div class={asHead ? 'wm-settings-feature-name' : 'wm-settings-row-label'}>{definition.label}</div>
        {definition.description && <p class="wm-settings-text">{definition.description}</p>}
      </div>
      <div class="wm-settings-row-control">
        {definition.type === 'boolean' ? (
          <Switch checked={value === true} label={definition.label} disabled={disabled} onChange={(next) => settings.set(name, next)} />
        ) : definition.type === 'choice' && definition.display === 'slider' ? (
          <StepSlider
            value={typeof value === 'number' ? value : definition.default}
            options={definition.options}
            label={definition.label}
            disabled={disabled}
            onChange={(next) => settings.set(name, next)}
          />
        ) : definition.type === 'choice' ? (
          <ChoiceField
            value={typeof value === 'number' ? value : definition.default}
            options={definition.options}
            label={definition.label}
            disabled={disabled}
            onChange={(next) => settings.set(name, next)}
          />
        ) : (
          <NumberField
            value={typeof value === 'number' ? value : definition.default}
            label={definition.label}
            min={definition.min}
            max={definition.max}
            {...(definition.step !== undefined && { step: definition.step })}
            {...(definition.unit !== undefined && { unit: definition.unit })}
            disabled={disabled}
            onChange={(next) => settings.set(name, next)}
          />
        )}
      </div>
    </div>
  );
}
