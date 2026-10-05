import { storedValueData, type DataSet } from '@/core/data';
import { jsonStore } from '@/core/storage';
import { SALES_RATE_KEY } from '@/services/market';
import { SUPABASE_KEY } from '@/site/api';
import { GUILD_KEY } from '@/site/guild';
import { ME_KEY } from '@/site/me';
import { PRO_KEY } from '@/site/pro';

const TAB = 'Technique';
const MAX_TEXT = 160;

/** La valeur telle qu'elle est gardée, en JSON sur une ligne (coupée au-delà de `MAX_TEXT`). */
function rawText(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
}

/** Une valeur apprise des réponses du site : lue telle quelle ; l'oublier, c'est la laisser se réapprendre. */
function technical(id: string, name: string, key: string, description: string): DataSet {
  return storedValueData({
    id,
    name,
    tab: TAB,
    description,
    key,
    store: jsonStore<unknown>(key, undefined, (raw) => raw),
    describe: (value) => (value === undefined ? undefined : { details: [rawText(value)] }),
  });
}

/** Ce que le script apprend du site pour le savoir au chargement suivant (version de dev) : jamais exporté. */
export const technicalData: readonly DataSet[] = [
  /* @__PURE__ */ technical('me', 'Compte reconnu', ME_KEY, 'Id et pseudo du joueur connecté, lus dans les réponses du site.'),
  /* @__PURE__ */ technical('pro', 'Statut PRO', PRO_KEY, 'Le dernier statut PRO vu dans les réponses du site.'),
  /* @__PURE__ */ technical('guild', 'Guilde', GUILD_KEY, 'La guilde du joueur, relue au plus toutes les 4 h.'),
  /* @__PURE__ */ technical('supabase', 'Clé publique du site', SUPABASE_KEY, 'Adresse de la base du site et sa clé publique, la même pour tous.'),
  /* @__PURE__ */ technical('sales-rate', 'Compteur de la limite des ventes', SALES_RATE_KEY, "Historiques demandés dans la minute en cours, commun aux onglets."),
];
