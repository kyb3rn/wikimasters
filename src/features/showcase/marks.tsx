import { useEffect, useRef, useState } from 'preact/hooks';
import { TAG_PALETTE, tagChipStyle } from '@/site/collection';
import { RARITIES, RARITY_NAMES, rarityBadgeStyle } from '@/site/rarity';
import { buttonClass } from '@/ui/button';
import { Icon, ICON_NAMES } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { stampFace, STAMPS, type Stamp } from '@/ui/stamp';
import { Group, Specimen } from './layout';

const OWNER = 'showcase';

interface DemoTag {
  readonly name: string;
  readonly color: string | undefined;
  readonly count: number;
}

const demoTags = (): readonly DemoTag[] =>
  ['favoris', 'à vendre', 'monuments', 'doublons', 'échange', 'Paris'].map((name, index) => ({
    name,
    color: TAG_PALETTE[(index * 3) % TAG_PALETTE.length],
    count: [12, 3, 48, 966, 7, 1][index] ?? 1,
  }));

/** Face de carte inventée, tamponnée comme celles du site. */
function StampedFace({ stamp }: { readonly stamp: Stamp }) {
  const face = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = face.current;
    if (!element) return undefined;
    stampFace(element, OWNER, stamp);
    return () => stampFace(element, OWNER, undefined);
  }, [stamp]);
  return (
    <div ref={face} class="wm-showcase-face">
      <div>
        <span>Tour Eiffel</span>
      </div>
    </div>
  );
}

const shownStamps = (): readonly (readonly [string, Stamp])[] =>
  Object.entries(STAMPS).map(([name, stamp]) => [name, { ...stamp, revealable: true }]);

export function Marks() {
  const [tags] = useState(demoTags);
  const [stamps] = useState(shownStamps);
  const [chips, setChips] = useState(tags);
  const remove = (tag: DemoTag) => {
    const next = chips.filter((chip) => chip !== tag);
    setChips(next.length > 0 ? next : tags);
  };
  return (
    <>
      <Group title="Badges">
        {RARITIES.map((rarity) => (
          <span key={rarity} class={siteClass.rarityBadge} style={rarityBadgeStyle(rarity)} title={RARITY_NAMES[rarity]}>
            {rarity}
          </span>
        ))}
        <span class={siteClass.proTag}>
          <Icon name="sparkles" class={siteClass.proTagIcon} />
          PRO
        </span>
      </Group>

      <Group title="Étiquettes">
        <div class={siteClass.tagChips}>
          {chips.map((tag) => (
            <span key={tag.name} class={siteClass.tagChip} style={tagChipStyle(tag.color)}>
              {tag.name}
              <button type="button" class={siteClass.tagChipRemove} aria-label={`Enlever ${tag.name}`} onClick={() => remove(tag)}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div class={siteClass.profileTags}>
          {tags.map((tag) => (
            <span key={tag.name} class={siteClass.profileTag} style={tagChipStyle(tag.color)}>
              <span class={siteClass.profileTagName}>{tag.name}</span>
              <span class={siteClass.profileTagCount}>×{tag.count}</span>
            </span>
          ))}
        </div>
      </Group>

      <Group title="Compteurs">
        <div class={siteClass.frame}>
          <span class={siteClass.counterPair}>
            <span class={`${siteClass.counterAccent} ${siteClass.counterCount}`}>6</span>
            <span class={`${siteClass.counterMuted} ${siteClass.counterMax}`}>/ 10</span>
          </span>
        </div>
        <div class={siteClass.frame}>
          <div class={siteClass.counterValue}>
            <span class={siteClass.counterTime}>01:23:45</span>
          </div>
          <div class={siteClass.counterLabel}>Prochain paquet</div>
        </div>
        <span class={siteClass.selectionCount}>
          <span class={siteClass.selectionCountValue}>3</span>
          <span class={siteClass.selectionCountLabel}>sélectionnées</span>
        </span>
        <div>
          <div class={siteClass.statValue}>1 416</div>
          <div class={siteClass.statLabel}>Cartes uniques</div>
        </div>
      </Group>

      <Group title="Pack PRO">
        <Specimen width="25rem">
          <div class={siteClass.proFrame}>
            <div>
              <div class={siteClass.proTitle}>Pack Pro</div>
              <div class={siteClass.proText}>Un paquet offert chaque jour aux comptes PRO.</div>
            </div>
            <button type="button" class={buttonClass('wide', { tone: 'pro', fill: 'solid' })}>
              Ouvrir
            </button>
          </div>
        </Specimen>
      </Group>

      <Group title="Tampons">
        {stamps.map(([name, stamp]) => (
          <StampedFace key={name} stamp={stamp} />
        ))}
      </Group>
    </>
  );
}

export function Icons() {
  return (
    <div class="wm-showcase-icons">
      {ICON_NAMES.map((name) => (
        <div key={name} class="wm-showcase-icon">
          <Icon name={name} size={22} />
          <span>{name}</span>
        </div>
      ))}
    </div>
  );
}
