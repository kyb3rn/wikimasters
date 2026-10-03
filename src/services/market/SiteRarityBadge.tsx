import { parseRarity, rarityColor, SITE_RARITY_LABELS } from '@/site/rarity';
import { siteClass } from '@/ui/site';
import { alpha } from '@/ui/theme';

/** Rareté d'une vente dans la vue du marché du site : son nom à sa couleur, sur sa teinte ; inconnue : rien. */
export function SiteRarityBadge({ rarity }: { readonly rarity: string }) {
  const known = parseRarity(rarity);
  if (!known) return null;
  const color = rarityColor(known);
  return (
    <span class={siteClass.marketViewRarity} style={{ color, backgroundColor: alpha(color, 18, 'srgb') }}>
      {SITE_RARITY_LABELS[known]}
    </span>
  );
}
