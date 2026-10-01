import type { MyGuild } from '@/site/guild';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';

export interface GuildRowProps {
  readonly guild: MyGuild;
  /** Conversation affichée. */
  readonly active: boolean;
  /** Ouverture en cours (la conversation précédente se ferme). */
  readonly busy: boolean;
  readonly onOpen: () => void;
}

/** Conversation de la guilde en tête de /dms, épinglée : une ligne comme les autres, puis un trait. */
export function GuildRow({ guild, active, busy, onOpen }: GuildRowProps) {
  return (
    <>
      <button
        type="button"
        class={`${siteClass.dmsRow}${active ? ` ${siteClass.dmsRowActive}` : ''}`}
        aria-current={active || undefined}
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={onOpen}
      >
        <div class={siteClass.dmsRowAvatarBox}>
          <div class={siteClass.dmsRowAvatar}>
            <Icon name="castle" busy={busy} size={20} />
          </div>
        </div>
        <div class={siteClass.dmsRowBody}>
          <div class={siteClass.dmsRowHead}>
            <p class={siteClass.dmsRowName}>{guild.name}</p>
            <span class={siteClass.dmsRowMeta} title="Épinglée">
              <Icon name="pin" size={12} />
            </span>
          </div>
          <p class={siteClass.dmsRowText}>Chat de la guilde</p>
        </div>
      </button>
      <div class={siteClass.dmsSeparator} role="separator" />
    </>
  );
}
