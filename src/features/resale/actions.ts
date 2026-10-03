import { useEffect, useReducer, useRef } from 'preact/hooks';
import { childController } from '@/core/async';
import type { Logger } from '@/core/log';
import { net } from '@/core/net';
import { listingOf, onListingsChange, trackListings } from '@/services/listings';
import { NETWORK_ERROR, readDiscard, setCopyStarred, siteErrorText, type OwnedCopy } from '@/site/api';
import { openCardModal, type CardModalProps, type OpenedCardModal } from '@/site/cards';
import { toast } from '@/ui/toast';

/** Après une action depuis la page : défaussée, mise aux enchères, ou étiquetée (elle n'est plus à vendre). */
export type CopyStatus = 'discarded' | 'listed' | 'tagged';

const MODAL_ERROR = "La modale de carte du site n'a pas pu s'ouvrir.";

export interface CopyActions {
  /** Ce qui est arrivé à l'exemplaire depuis son affichage ; rien : toujours à vendre. */
  statusOf(copy: OwnedCopy): CopyStatus | undefined;
  /** Ouvre la modale de carte du site pour l'exemplaire (une à la fois). */
  open(copy: OwnedCopy): void;
  /** Nouvelle lecture des cartes : les actions passées n'y sont plus. */
  reset(): void;
}

interface OpenModal {
  readonly copy: OwnedCopy;
  readonly controller: AbortController;
  tags: readonly unknown[];
  starred: boolean;
  opened?: OpenedCardModal;
}

const tagCount = (tags: unknown): number => (Array.isArray(tags) ? tags.length : 0);

/**
 * Actions sur les exemplaires de la page, par la modale de carte du site (`openCardModal`) : Vendre, Défausser,
 * étiquettes et favori, avec nos fonctionnalités de la modale (présentation, défaussage rapide, rester sur la carte,
 * mise en vente). Chaque action est reconnue à l'exemplaire, jamais au titre : défausse réussie (`readDiscard`), mise
 * aux enchères acceptée (`listingOf`), étiquette posée (la modale donne la nouvelle liste). La carte reste en place,
 * tamponnée, jusqu'à la prochaine lecture.
 */
export function useCopyActions({ signal, log, copies }: { signal: AbortSignal; log: Logger; copies: readonly OwnedCopy[] }): CopyActions {
  const [, bump] = useReducer((count: number) => count + 1, 0);
  const redraw = () => bump(undefined);
  const statuses = useRef(new Map<string, CopyStatus>());
  const starred = useRef(new Map<string, boolean>());
  const modal = useRef<OpenModal>();
  const latestCopies = useRef(copies);
  latestCopies.current = copies;

  const mark = (id: string, status: CopyStatus | undefined) => {
    if (statuses.current.get(id) === status) return;
    if (status) statuses.current.set(id, status);
    else statuses.current.delete(id);
    redraw();
  };

  useEffect(() => {
    trackListings();
    onListingsChange(redraw, { signal });
    net.observe(
      (request) => readDiscard(request) !== undefined,
      (exchange) => {
        const discarded = readDiscard(exchange.request);
        if (exchange.ok && discarded) mark(discarded.userCardId, 'discarded');
      },
      { signal },
    );
  }, [signal]);

  function statusOf(copy: OwnedCopy): CopyStatus | undefined {
    const status = statuses.current.get(copy.id);
    if (status === 'discarded') return status;
    return listingOf(copy.id) ? 'listed' : status;
  }

  const starredOf = (copy: OwnedCopy) => starred.current.get(copy.id) ?? copy.starred;

  function props(open: OpenModal): CardModalProps {
    const { copy } = open;
    const count = latestCopies.current.filter((other) => other.cardId === copy.cardId && statusOf(other) === undefined).length;
    return {
      card: copy.siteCard,
      userCardId: copy.id,
      starred: open.starred,
      // Au moins 1 : l'exemplaire est là, ses actions aussi (la Collection compte ceux de sa page).
      count: Math.max(1, count),
      tags: open.tags,
      onToggleStar: () => void toggleStar(open),
      onTagsChange: (tags) => {
        open.tags = Array.isArray(tags) ? (tags as unknown[]) : [];
        open.opened?.update(props(open));
        if (statuses.current.get(copy.id) !== 'discarded') mark(copy.id, tagCount(tags) > 0 ? 'tagged' : undefined);
      },
      onCollectionChange: () => undefined,
    };
  }

  /** Comme la Collection : le favori de l'exemplaire, demandé à Supabase par la page. */
  async function toggleStar(open: OpenModal): Promise<void> {
    const next = !open.starred;
    try {
      await setCopyStarred(open.copy.id, next);
    } catch (error) {
      toast.error(siteErrorText(error), { title: 'Favori' });
      return;
    }
    open.starred = next;
    starred.current.set(open.copy.id, next);
    open.opened?.update(props(open));
  }

  function open(copy: OwnedCopy): void {
    if (modal.current || signal.aborted) return;
    const main = document.querySelector('main');
    if (!main) return;
    const current: OpenModal = { copy, controller: childController(signal), tags: [], starred: starredOf(copy) };
    modal.current = current;
    const forget = () => {
      current.controller.abort();
      if (modal.current === current) modal.current = undefined;
    };
    openCardModal(props(current), {
      contextFrom: main,
      signal: current.controller.signal,
      onClosed: forget,
      onError: (error) => {
        log.error('modale de carte en échec', error);
        forget();
      },
    })
      .then((opened) => {
        if (current.controller.signal.aborted) opened.close();
        else current.opened = opened;
      })
      .catch((error: unknown) => {
        forget();
        if (signal.aborted) return;
        log.warn('modale de carte non ouverte', error);
        toast.error(error instanceof Error && error.name === 'ChunkLoadError' ? NETWORK_ERROR : MODAL_ERROR, { title: 'Revente' });
      });
    // La page quittée la ferme.
    current.controller.signal.addEventListener('abort', () => current.opened?.close(), { once: true });
  }

  return {
    statusOf,
    open,
    reset() {
      statuses.current.clear();
      starred.current.clear();
      redraw();
    },
  };
}
