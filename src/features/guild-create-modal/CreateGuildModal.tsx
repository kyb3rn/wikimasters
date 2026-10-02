import { useEffect, useRef, useState } from 'preact/hooks';
import { GUILD_DESCRIPTION_MAX, GUILD_NAME_MAX, GUILD_NAME_MIN } from '@/site/api';
import { buttonClass } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { Modal } from '@/ui/modal';
import { siteClass } from '@/ui/site';

export interface CreateGuildProps {
  /** Saisie de la dernière ouverture. */
  readonly initialName: string;
  readonly initialDescription: string;
  /** Saisie gardée pour la prochaine ouverture. */
  readonly onDraft: (name: string, description: string) => void;
  /** Crée la guilde : message d'erreur à afficher, ou rien quand elle est créée (la fenêtre est alors fermée). */
  readonly onSubmit: (name: string, description: string) => Promise<string | undefined>;
  readonly onClose: () => void;
}

/** « Créer une guilde » : nom, description, erreur du site, « Créer la guilde ». */
export function CreateGuildModal(props: CreateGuildProps) {
  const [name, setName] = useState(props.initialName);
  const [description, setDescription] = useState(props.initialDescription);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const canSubmit = !sending && name.trim().length >= GUILD_NAME_MIN;

  // À l'ouverture, et après un envoi refusé (le champ, désactivé pendant la requête, a perdu le focus).
  useEffect(() => {
    if (!sending) nameInput.current?.focus();
  }, [sending]);

  const submit = async () => {
    if (!canSubmit) return;
    setSending(true);
    setError(undefined);
    const message = await props.onSubmit(name.trim(), description.trim());
    if (message === undefined) return;
    setError(message);
    setSending(false);
  };

  return (
    <Modal title="Créer une guilde" width={480} padded locked={sending} onClose={props.onClose}>
      <form
        class={siteClass.formStack}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div class={siteClass.formFields}>
          <label class={siteClass.formField}>
            <span class={siteClass.fieldLabel}>Nom de la guilde</span>
            <input
              ref={nameInput}
              type="text"
              class={cx(siteClass.textField, siteClass.formControl)}
              placeholder="Les Conquérants"
              maxLength={GUILD_NAME_MAX}
              value={name}
              disabled={sending}
              onInput={(event) => {
                setName(event.currentTarget.value);
                props.onDraft(event.currentTarget.value, description);
              }}
            />
            <p class={siteClass.formCounter}>
              {name.length}/{GUILD_NAME_MAX}
            </p>
          </label>
          <label class={siteClass.formField}>
            <span class={siteClass.fieldLabel}>Description (optionnel)</span>
            <textarea
              class={cx(siteClass.textField, siteClass.formControl, siteClass.formTextarea)}
              placeholder="Décrivez votre guilde…"
              maxLength={GUILD_DESCRIPTION_MAX}
              rows={3}
              value={description}
              disabled={sending}
              onInput={(event) => {
                setDescription(event.currentTarget.value);
                props.onDraft(name, event.currentTarget.value);
              }}
            />
            <p class={siteClass.formCounter}>
              {description.length}/{GUILD_DESCRIPTION_MAX}
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
