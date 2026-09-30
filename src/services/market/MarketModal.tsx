import { useEffect, useState } from 'preact/hooks';
import { errorMessage } from '@/core/log';
import { RARITY_NAMES, rarityBadgeStyle } from '@/site/rarity';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { Modal } from '@/ui/modal';
import { siteClass } from '@/ui/site';
import { toast } from '@/ui/toast';
import type { MarketEntry } from './cache';
import { ageText } from './format';
import { fetchMarket, onMarketChange, type MarketCard } from './market';
import { MarketView } from './MarketView';
import { marketSettings } from './settings';

export interface MarketModalProps {
  readonly card: MarketCard;
  readonly entry: MarketEntry;
  readonly onClose: () => void;
}

/** « <b>116</b> ventes · données du 30/09 03:11 (à l'instant) » ; la rareté est dans le badge du titre. */
function Subtitle({ entry }: { entry: MarketEntry }) {
  const count = entry.sales.length;
  const fetched = new Date(entry.fetchedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <>
      <b>{count}</b> vente{count > 1 ? 's' : ''} · données du {fetched} ({ageText(entry.fetchedAt)})
    </>
  );
}

/** Historique des ventes d'une carte, en modale ; « Actualiser » redemande les ventes au site. */
export function MarketModal({ card, entry: initial, onClose }: MarketModalProps) {
  const [entry, setEntry] = useState(initial);
  const [selection, setSelection] = useState<readonly string[]>();
  const [refreshing, setRefreshing] = useState(false);
  const [showAverages, setShowAverages] = useState(() => marketSettings.get('movingAverages'));

  // Ventes rechargées ailleurs (le site, un autre bouton) : affichées aussitôt.
  useEffect(() => {
    const controller = new AbortController();
    onMarketChange((next) => next.cardId === card.id && setEntry(next), { signal: controller.signal });
    return () => controller.abort();
  }, [card.id]);

  const refresh = () => {
    setRefreshing(true);
    fetchMarket(card)
      .then(setEntry)
      .catch((error: unknown) => toast.error(errorMessage(error), { title: 'Ventes non actualisées' }))
      .finally(() => setRefreshing(false));
  };

  return (
    <Modal
      title={card.title || entry.title}
      titleBefore={
        card.rarity && (
          <span class={siteClass.rarityBadge} style={rarityBadgeStyle(card.rarity)} title={`Rareté actuelle : ${RARITY_NAMES[card.rarity]}`}>
            {card.rarity}
          </span>
        )
      }
      subtitle={<Subtitle entry={entry} />}
      width={880}
      onClose={onClose}
      actions={
        <button type="button" class={buttonClass('standard')} disabled={refreshing} title="Recharger depuis le site" onClick={refresh}>
          <Icon name={refreshing ? 'spinner' : 'reload'} size={16} class={refreshing ? 'wm-spin' : undefined} />
          Actualiser
        </button>
      }
    >
      <MarketView
        card={card}
        entry={entry}
        selection={selection}
        onSelect={setSelection}
        showAverages={showAverages}
        onShowAverages={(on) => {
          setShowAverages(on);
          marketSettings.set('movingAverages', on);
        }}
      />
    </Modal>
  );
}
