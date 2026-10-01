import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';

/** Colonne de droite sans conversation (roue pendant le passage d'une conversation à une autre). */
export function EmptyPanel(props: { busy: boolean }) {
  return (
    <div class={siteClass.dmsPanel} aria-busy={props.busy || undefined}>
      {props.busy ? (
        <Icon name="spinner" size={32} class={siteClass.emptyIcon} />
      ) : (
        <>
          <Icon name="message" size={32} class={siteClass.emptyIcon} />
          <p class={siteClass.emptyText}>Choisissez une conversation.</p>
        </>
      )}
    </div>
  );
}
