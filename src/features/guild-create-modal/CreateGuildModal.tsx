import { useEffect, useRef, useState } from 'preact/hooks';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { Modal } from '@/ui/modal';
import { siteClass } from '@/ui/site';

export interface CreateGuildProps {
  /** Valeurs déjà dans le formulaire du site (il les garde après « Annuler »). */
  readonly initialName: string;
  readonly initialDescription: string;
  readonly nameMax: number;
  readonly descriptionMax: number;
  readonly error: string | undefined;
  readonly sending: boolean;
  readonly onName: (value: string) => void;
  readonly onDescription: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onClose: () => void;
}

/** Nom le plus court accepté par le site. */
const NAME_MIN = 2;

/** « Créer une guilde » : nom, description, erreur du site, « Créer la guilde ». */
export function CreateGuildModal(props: CreateGuildProps) {
  const { nameMax, descriptionMax, error, sending } = props;
  const [name, setName] = useState(props.initialName);
  const [description, setDescription] = useState(props.initialDescription);
  const nameInput = useRef<HTMLInputElement>(null);
  const canSubmit = !sending && name.trim().length >= NAME_MIN;

  // À l'ouverture, et après un envoi refusé (le champ, désactivé pendant la requête, a perdu le focus).
  useEffect(() => {
    if (!sending) nameInput.current?.focus();
  }, [sending]);

  return (
    <Modal title="Créer une guilde" width={480} padded locked={sending} onClose={props.onClose}>
      <form
        class={siteClass.formStack}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) props.onSubmit();
        }}
      >
        <div class={siteClass.formFields}>
          <label class={siteClass.formField}>
            <span class={siteClass.formLabel}>Nom de la guilde</span>
            <input
              ref={nameInput}
              type="text"
              class={siteClass.formInput}
              placeholder="Les Conquérants"
              maxLength={nameMax}
              value={name}
              disabled={sending}
              onInput={(event) => {
                setName(event.currentTarget.value);
                props.onName(event.currentTarget.value);
              }}
            />
            <p class={siteClass.formCounter}>
              {name.length}/{nameMax}
            </p>
          </label>
          <label class={siteClass.formField}>
            <span class={siteClass.formLabel}>Description (optionnel)</span>
            <textarea
              class={`${siteClass.formInput} ${siteClass.formTextarea}`}
              placeholder="Décrivez votre guilde…"
              maxLength={descriptionMax}
              rows={3}
              value={description}
              disabled={sending}
              onInput={(event) => {
                setDescription(event.currentTarget.value);
                props.onDescription(event.currentTarget.value);
              }}
            />
            <p class={siteClass.formCounter}>
              {description.length}/{descriptionMax}
            </p>
          </label>
        </div>
        {error && <p class={siteClass.formError}>{error}</p>}
        <button
          type="submit"
          class={buttonClass('wide', { tone: 'accent', fill: 'solid', size: 'lg' })}
          disabled={!canSubmit}
          aria-busy={sending}
        >
          {sending && <Icon name="spinner" size={16} />}
          Créer la guilde
        </button>
      </form>
    </Modal>
  );
}
