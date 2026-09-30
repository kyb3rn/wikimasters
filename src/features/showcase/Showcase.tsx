import { siteClass } from '@/ui/site';
import { Buttons } from './buttons';
import { Modals, Toasts } from './feedback';
import { Fields } from './fields';
import { Section, type SectionInfo } from './layout';
import { Icons, Marks } from './marks';

const SECTIONS = {
  buttons: { id: 'buttons', title: 'Boutons' },
  fields: { id: 'fields', title: 'Champs et choix' },
  feedback: { id: 'feedback', title: 'Toasts et modales' },
  marks: { id: 'marks', title: 'Badges, étiquettes, tampons' },
  icons: { id: 'icons', title: 'Icônes' },
} as const satisfies Record<string, SectionInfo>;

const scrollTo = (section: SectionInfo) =>
  document.getElementById(`wm-showcase-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Tous nos contrôles, dans tous leurs états, aux couleurs du site. */
export function Showcase({ signal }: { readonly signal: AbortSignal }) {
  return (
    <div class="wm-showcase-page">
      <header class="wm-showcase-top">
        <h1 class="wm-showcase-title">Vitrine</h1>
        <nav class={siteClass.pills} aria-label="Sections">
          {Object.values(SECTIONS).map((section) => (
            <button key={section.id} type="button" class={`${siteClass.pill} ${siteClass.pillIdle}`} onClick={() => scrollTo(section)}>
              {section.title}
            </button>
          ))}
        </nav>
      </header>
      <Section section={SECTIONS.buttons}>
        <Buttons />
      </Section>
      <Section section={SECTIONS.fields}>
        <Fields />
      </Section>
      <Section section={SECTIONS.feedback}>
        <Toasts />
        <Modals signal={signal} />
      </Section>
      <Section section={SECTIONS.marks}>
        <Marks />
      </Section>
      <Section section={SECTIONS.icons}>
        <Icons />
      </Section>
    </div>
  );
}
