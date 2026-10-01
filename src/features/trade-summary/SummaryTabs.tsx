import type { TradeSide, TradeSummary, TradeSummarySide } from '@/site/trades';
import { Icon } from '@/ui/icons';

const plural = (count: number, word: string) => `${count.toLocaleString('fr-FR')} ${word}${count > 1 ? 's' : ''}`;

interface SideProps {
  readonly side: TradeSummarySide;
  readonly name: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

function Side({ side, name, selected, onSelect }: SideProps) {
  return (
    <button type="button" role="tab" class="wm-trade-sum-side" aria-selected={selected} onClick={onSelect}>
      <span class="wm-trade-sum-name">{name}</span>
      <span class="wm-trade-sum-counts">
        <span class="wm-trade-sum-value" data-active={side.cards > 0 ? '' : undefined} title={plural(side.cards, 'carte')}>
          {String(side.cards)}
          <Icon name="card" size={18} />
        </span>
        <span class="wm-trade-sum-value" data-active={side.wikibidous > 0 ? '' : undefined} title={plural(side.wikibidous, 'wikibidou')}>
          {side.wikibidous.toLocaleString('fr-FR')}
          <Icon name="coin" size={18} />
        </span>
      </span>
    </button>
  );
}

export interface SummaryTabsProps {
  readonly summary: TradeSummary;
  /** Pseudo du joueur connecté, à la place du « Moi » du site s'il est connu. */
  readonly myName: string | undefined;
  /** Onglet affiché ; `undefined` : le résumé ne sert pas d'onglets. */
  readonly shown: TradeSide | undefined;
  readonly onSelect: (side: TradeSide) => void;
}

/** Les deux côtés de l'échange, chacun onglet de ses cartes, l'icône d'échange au milieu. */
export function SummaryTabs({ summary, myName, shown, onSelect }: SummaryTabsProps) {
  return (
    <div class="wm-trade-sum" role="tablist" aria-label="Côtés de l'échange">
      <Side side={summary.mine} name={myName ?? summary.mine.name} selected={shown === 'mine'} onSelect={() => onSelect('mine')} />
      <Icon name="exchange" size={24} class="wm-trade-sum-arrow" />
      <Side side={summary.theirs} name={summary.theirs.name} selected={shown === 'theirs'} onSelect={() => onSelect('theirs')} />
    </div>
  );
}
