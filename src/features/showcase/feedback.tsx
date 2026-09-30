import { useState } from 'preact/hooks';
import { sleep } from '@/core/async';
import { showMarketModal, showProOffer } from '@/services/market';
import { rarityBadgeStyle } from '@/site/rarity';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { Modal, openConfirm } from '@/ui/modal';
import { siteClass } from '@/ui/site';
import { toast, type ToastOptions } from '@/ui/toast';
import { DEMO_CARD, demoEntry } from './demo';
import { DEMO_BUSY_MS, Group } from './layout';

const TOASTS: readonly { readonly label: string; readonly options: ToastOptions }[] = [
  {
    label: 'Erreur',
    options: { variant: 'error', title: 'Défausse refusée', message: 'Le site a répondu 500 : la carte n’a pas été défaussée.' },
  },
  {
    label: 'Avertissement',
    options: { variant: 'warning', title: 'Ventes non actualisées', message: 'Données du cache, vieilles de 3 jours.' },
  },
  {
    label: 'Succès',
    options: {
      variant: 'success',
      title: 'Enchère lancée',
      message: 'Tour Eiffel · mise de départ 10, pour 1 h.',
      action: { label: 'Voir l’enchère', onClick: () => undefined },
    },
  },
  { label: 'Info', options: { variant: 'info', title: 'Sonde de la Collection lancée', message: 'Lecture seule, 3 à 4 minutes.' } },
  { label: 'Sans titre', options: { variant: 'info', message: 'Un message seul, sans titre.' } },
  {
    label: 'Sans durée',
    options: { variant: 'error', sticky: true, title: 'Reste jusqu’à fermeture', message: 'Seule la croix le ferme.' },
  },
];

export function Toasts() {
  return (
    <Group title="Toasts">
      {TOASTS.map(({ label, options }) => (
        <button key={label} type="button" class={buttonClass('standard')} onClick={() => toast.show(options)}>
          {label}
        </button>
      ))}
      <button
        type="button"
        class={buttonClass('standard')}
        onClick={() => TOASTS.filter(({ options }) => !options.sticky).forEach(({ options }) => toast.show(options))}
      >
        Tout d’un coup
      </button>
    </Group>
  );
}

export function Modals({ signal }: { readonly signal: AbortSignal }) {
  const [open, setOpen] = useState(false);
  const confirm = (fails: boolean) =>
    openConfirm({
      title: 'Défausser cette carte ?',
      message: 'Elle quitte ta collection pour de bon.',
      confirmLabel: 'Défausser',
      signal,
      onConfirm: async () => {
        await sleep(DEMO_BUSY_MS, signal);
        if (fails) toast.error('Le site a répondu 500 : la carte n’a pas été défaussée.', { title: 'Défausse refusée' });
        else toast.success('Tour Eiffel a été défaussée.', { title: 'Carte défaussée' });
      },
    });

  return (
    <>
      <Group title="Modales">
        <button type="button" class={buttonClass('standard')} onClick={() => setOpen(true)}>
          Modale
        </button>
        <button type="button" class={buttonClass('standard')} onClick={() => confirm(false)}>
          Confirmation
        </button>
        <button type="button" class={buttonClass('standard')} onClick={() => confirm(true)}>
          Confirmation en échec
        </button>
        <button type="button" class={buttonClass('standard')} onClick={() => showMarketModal(DEMO_CARD, demoEntry(Date.now()))}>
          <Icon name="market" size={16} />
          Historique des ventes
        </button>
        <button type="button" class={buttonClass('standard')} onClick={() => showProOffer(DEMO_CARD)}>
          <Icon name="sparkles" size={16} />
          Offre PRO
        </button>
      </Group>
      {open && (
        <Modal
          title="Titre"
          titleBefore={
            <span class={siteClass.rarityBadge} style={rarityBadgeStyle('SR')}>
              SR
            </span>
          }
          subtitle="Sous-titre"
          actions={
            <button type="button" class={buttonClass('standard')}>
              <Icon name="reload" size={16} />
              Actualiser
            </button>
          }
          width={560}
          onClose={() => setOpen(false)}
        >
          <p style={{ margin: 0, padding: '20px', fontSize: '13px', opacity: 0.8 }}>Contenu.</p>
        </Modal>
      )}
    </>
  );
}
