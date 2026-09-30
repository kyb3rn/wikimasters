import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { parseRarity, rarityColor } from '@/site/rarity';
import { Switch } from '@/ui/controls';
import { Icon } from '@/ui/icons';
import type { MarketEntry } from './cache';
import { chartModel } from './chart';
import { formatDate, formatNumber, plural, round1 } from './format';
import type { MarketCard } from './market';
import { AVERAGE_WINDOWS, SalesChart } from './SalesChart';
import { marketSettings } from './settings';
import { lastMean, saleRarity, salesStats } from './stats';

/** Touches de vue actives (réglages), pour l'info-bulle du titre du graphique. */
const VIEW_KEYS = [
  { setting: 'recentKey', help: 'R : les 30 derniers jours' },
  { setting: 'allKey', help: 'A : toutes les ventes' },
] as const;

const viewKeys = () => VIEW_KEYS.filter(({ setting }) => marketSettings.get(setting)).map((key) => key.help);

const chartHelp = (keys: readonly string[]) =>
  'Survoler un point : prix, date, rareté. Maj : lecture des moyennes au curseur. Ctrl : règle horizontale avec le ' +
  'prix à gauche. Glisser dans le tracé : déplacer (les deux axes, jusque sous zéro). Glisser sur l’axe des dates ' +
  '(droite = zoom avant) ou des prix (haut = zoom avant) : zoom de cet axe. Molette : zoom des deux axes autour du ' +
  `curseur (un seul axe sur sa graduation). ${keys.map((key) => `${key}. `).join('')}Raretés au-dessus : choisir les ventes affichées.`;

const CHIP_HELP = 'Afficher ou masquer cette rareté (points, moyennes et tuiles suivent la sélection)';

const Coin = () => <Icon name="coin" class="wm-market-coin" />;

function Tile({ label, sub, children }: { label: string; sub?: string; children: ComponentChildren }) {
  return (
    <div class="wm-market-tile">
      <span class="wm-market-label">{label}</span>
      {children}
      {sub && <span class="wm-market-sub">{sub}</span>}
    </div>
  );
}

const Price = ({ value }: { value: number | undefined }) => (
  <span class="wm-market-value">
    <Coin />
    {value === undefined ? '?' : formatNumber(value)}
  </span>
);

const Plain = ({ children }: { children: ComponentChildren }) => (
  <span class="wm-market-value" data-plain>
    {children}
  </span>
);

const Dash = () => (
  <Plain>
    <span class="wm-market-muted">—</span>
  </Plain>
);

/** Raretés affichées : celles demandées qui ont des ventes, sinon la rareté de la carte si elle en a, sinon toutes. */
export function selectRarities(available: readonly string[], wanted: readonly string[] | undefined, own: string | undefined): string[] {
  const kept = (wanted ?? []).filter((rarity) => available.includes(rarity));
  if (kept.length) return kept;
  return own && available.includes(own) ? [own] : [...available];
}

export interface MarketViewProps {
  readonly card: MarketCard;
  readonly entry: MarketEntry;
  /** Raretés choisies ; `undefined` : le choix par défaut. */
  readonly selection: readonly string[] | undefined;
  readonly onSelect: (rarities: string[]) => void;
  readonly showAverages: boolean;
  readonly onShowAverages: (on: boolean) => void;
}

/**
 * Historique des ventes d'une carte : tuiles (ventes, dernière, médiane, moyenne des 7 dernières, min – max,
 * médiane des 30 derniers jours), raretés (bascules), graphique. Tuiles, points et moyennes portent sur les raretés
 * choisies ; les bascules donnent les chiffres de chaque rareté.
 */
export function MarketView({ card, entry, selection, onSelect, showAverages, onShowAverages }: MarketViewProps) {
  const view = useMemo(() => {
    const all = salesStats(entry.sales, card.rarity);
    const rarities = all.byRarity.map((group) => group.rarity);
    const selected = selectRarities(rarities, selection, card.rarity);
    const everything = selected.length === rarities.length;
    const shown = everything ? all : salesStats(all.sales.filter((sale) => selected.includes(saleRarity(sale))), card.rarity);
    return {
      all,
      rarities,
      selected,
      everything,
      shown,
      mean7: lastMean(shown.sales, 7),
      model: chartModel(shown.sales, AVERAGE_WINDOWS),
    };
  }, [entry, selection, card.rarity]);
  const { all, rarities, selected, everything, shown, mean7, model } = view;

  const toggle = (rarity: string) => {
    if (rarity === '*') return onSelect([...rarities]);
    const next = selected.includes(rarity) ? selected.filter((other) => other !== rarity) : [...selected, rarity];
    if (next.length) onSelect(next);
  };

  return (
    <div class="wm-market">
      {shown.count && shown.last ? (
        <div class="wm-market-tiles">
          <Tile label="Ventes">
            <Plain>{shown.count}</Plain>
          </Tile>
          <Tile label={`Dernière (${formatDate(shown.last.time)}${shown.last.rarity ? ` · ${shown.last.rarity}` : ''})`}>
            <Price value={shown.last.price} />
          </Tile>
          <Tile
            label="Médiane"
            sub={
              everything && card.rarity && all.same.count && all.same.count !== all.count
                ? `en ${card.rarity} : ${formatNumber(all.same.median ?? 0)} (${all.same.count})`
                : undefined
            }
          >
            <Price value={shown.median} />
          </Tile>
          <Tile label="Moy. 7 dernières" sub={mean7 && mean7.count < 7 ? `sur ${plural(mean7.count, 'vente')}` : undefined}>
            <Price value={mean7 && round1(mean7.price)} />
          </Tile>
          <Tile label="Min – max">
            <span class="wm-market-value">
              <Coin />
              {formatNumber(shown.min ?? 0)} – {formatNumber(shown.max ?? 0)}
            </span>
          </Tile>
          <Tile label={`Médiane 30 derniers jours${shown.last30.count ? ` (${plural(shown.last30.count, 'vente')})` : ''}`}>
            {shown.last30.count ? (
              <Price value={shown.last30.median} />
            ) : (
              <Plain>
                <span class="wm-market-muted">aucune vente</span>
              </Plain>
            )}
          </Tile>
        </div>
      ) : (
        <div class="wm-market-tiles" data-empty>
          <Tile label="Ventes" sub="aucune vente enregistrée">
            <Plain>0</Plain>
          </Tile>
          <Tile label="Dernière">
            <Dash />
          </Tile>
          <Tile label="Médiane">
            <Dash />
          </Tile>
          <Tile label="Moy. 7 dernières">
            <Dash />
          </Tile>
          <Tile label="Min – max">
            <Dash />
          </Tile>
          <Tile label="Médiane 30 derniers jours">
            <Dash />
          </Tile>
        </div>
      )}
      {all.byRarity.length > 0 && (
        <div class="wm-market-chips">
          {all.byRarity.map((group) => {
            const known = parseRarity(group.rarity);
            return (
              <button
                key={group.rarity}
                type="button"
                class="wm-market-chip"
                aria-pressed={selected.includes(group.rarity)}
                style={known ? { color: rarityColor(known) } : undefined}
                title={CHIP_HELP}
                onClick={() => toggle(group.rarity)}
              >
                <b>{group.rarity}</b>
                {`\u00a0· ${plural(group.count, 'vente')} · méd. ${formatNumber(group.median)} · ${formatNumber(group.min)}–${formatNumber(group.max)}`}
              </button>
            );
          })}
          {rarities.length > 1 && (
            <button type="button" class="wm-market-chip" aria-pressed={everything} title="Afficher toutes les raretés" onClick={() => toggle('*')}>
              Toutes
            </button>
          )}
        </div>
      )}
      {model && (
        <div class="wm-market-history">
          <div class="wm-market-chart-head">
            <span class="wm-market-title" title={chartHelp(viewKeys())}>
              {everything ? 'Historique complet' : `Historique ${selected.join(' + ')}`}
            </span>
            {model.averages.length > 0 && (
              <span
                class="wm-market-averages"
                title={`Moyenne mobile simple des ${AVERAGE_WINDOWS.map(({ n }) => n).join(' et des ')} dernières ventes (pointillé : début de courbe avec moins de ventes). Maj : les affiche et atténue le reste.`}
              >
                <span>
                  Moyennes{' '}
                  {AVERAGE_WINDOWS.map(({ n, color }, index) => (
                    <>
                      {index > 0 && ' · '}
                      <i style={{ color }}>{n}</i>
                    </>
                  ))}
                </span>
                <Switch label="Afficher les moyennes mobiles" checked={showAverages} onChange={onShowAverages} />
              </span>
            )}
          </div>
          <div class="wm-market-chart-box">
            <SalesChart key={`${entry.fetchedAt} ${selected.join()}`} model={model} showAverages={showAverages} />
          </div>
        </div>
      )}
    </div>
  );
}
