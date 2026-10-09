/** Un élément d'une donnée gardée, tel que la fenêtre Mémoire le liste. */
export interface DataItem {
  /** Identifiant dans sa donnée (carte, clé…), passé à `remove`. */
  readonly key: string;
  readonly title: string;
  /** Rareté (code du site : L, UR…), en badge devant le titre. */
  readonly rarity?: string;
  readonly shiny?: boolean;
  /** Faits courts, dans l'ordre (« 47 ventes », « 180 wb »…). */
  readonly details?: readonly string[];
  /** Date de l'élément (ms) : chargement, enregistrement, arrivée… */
  readonly date?: number;
  /** Donnée ancienne (cache à redemander au site) : sa date est mise en avant. */
  readonly stale?: boolean;
  /** Nombre d'entrées (ventes, mises en vente), pour le tri. */
  readonly count?: number;
  /** Prix médian des ventes par rareté (code du site, `?` : inconnue) : filtres de rareté et de prix. */
  readonly medians?: Readonly<Record<string, number>>;
  /** Date de la dernière vente (ms) : filtre « Plus vendue depuis ». */
  readonly lastSale?: number;
  /** Taille approximative (caractères de son JSON). */
  readonly bytes: number;
  /** Entrées supprimables une à une (mises en vente d'une carte) ; leur `key` est passée à `remove`. */
  readonly children?: readonly DataItem[];
}

/** Ce qu'un import ajoute ou change, élément par élément (une carte, un réglage…). */
export interface ImportCounts {
  readonly added: number;
  readonly updated: number;
  readonly unchanged: number;
  /** Éléments illisibles du fichier, écartés. */
  readonly invalid: number;
}

/** Donnée qui passe d'un navigateur à l'autre par l'export et l'import. */
export interface DataSetTransfer {
  /** Ce que le fichier contient pour cette donnée (JSON). */
  readonly dump: () => Promise<unknown>;
  /**
   * Fusionne ce que le fichier contient avec ce qui est gardé ici : ce qui manque est ajouté, et la version la plus
   * récente de chaque élément l'emporte. `apply` faux : rien n'est écrit, les comptes seulement (aperçu). `undefined` :
   * contenu illisible.
   */
  readonly merge: (raw: unknown, apply: boolean) => Promise<ImportCounts | undefined>;
}

/**
 * Une donnée gardée par le script (cache, historique, filtres…), déclarée par la fonctionnalité qui s'en sert
 * (`Feature.data`) : la fenêtre Mémoire la liste, la supprime, l'exporte.
 */
export interface DataSet {
  /** Identifiant stable : clé de la donnée dans le fichier d'export. */
  readonly id: string;
  /** Nom du concept (« Historique du marché ») : titre de sa section, ou de sa ligne. */
  readonly name: string;
  /** Onglet de la fenêtre Mémoire où elle se range (« Notifications »…). */
  readonly tab: string;
  /** Ce que c'est, en une phrase simple. */
  readonly description: string;
  /** Où elle est rangée : clés du localStorage (`wm-…`), ou `idb:<base>/<magasin>`. */
  readonly storage: readonly string[];
  /** Une seule valeur (filtres retenus…) : une ligne, avec celles des autres données du même genre de l'onglet. */
  readonly single?: boolean;
  /** Longue liste : recherche par titre, tri, sélection, pages. */
  readonly large?: boolean;
  /** Filtres des ventes (raretés, prix médian, nombre de ventes, date du chargement, dernière vente) : `medians`, `lastSale`. */
  readonly salesFilters?: boolean;
  readonly list: () => Promise<readonly DataItem[]>;
  /** Absent : rien ne se supprime d'ici (réglages : les remettre comme à l'installation n'est pas voulu). */
  readonly remove?: (keys: readonly string[]) => Promise<void>;
  readonly clear?: () => Promise<void>;
  /** Clic sur un élément (l'historique d'une carte). */
  readonly open?: (key: string) => void;
  /** Redemande un élément à sa source (les ventes d'une carte au site) ; montre elle-même son échec. */
  readonly refresh?: (key: string) => Promise<void>;
  readonly transfer?: DataSetTransfer;
}
