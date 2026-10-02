import { useEffect, useRef, useState } from 'preact/hooks';
import { SearchButton } from '@/services/list-search';
import { siteClass } from '@/ui/site';
import { BAR, BUTTON } from './style';

export interface SearchFieldProps {
  /** Texte de la recherche affichée (champ du site, caché). */
  readonly searched: string;
  readonly placeholder: string;
  /** Du lancement jusqu'à la réponse du site. */
  readonly busy: boolean;
  readonly onSearch: (text: string) => void;
}

/** Champ qui ne cherche qu'à Entrée ou par sa loupe ; loupe désactivée tant que le texte est celui déjà cherché. */
export function SearchField({ searched, placeholder, busy, onSearch }: SearchFieldProps) {
  const [draft, setDraft] = useState(searched);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const run = () => {
    if (!busy && draft !== searched) onSearch(draft);
  };
  return (
    <div class={BAR}>
      <input
        ref={input}
        type="text"
        class={siteClass.textField}
        value={draft}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="none"
        spellcheck={false}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          run();
        }}
      />
      <SearchButton status={busy ? 'loading' : 'search'} disabled={draft === searched} onClick={run} name={BUTTON} />
    </div>
  );
}
