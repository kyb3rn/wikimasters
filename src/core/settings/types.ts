interface CommonSetting {
  readonly label: string;
  readonly description?: string;
  /** Affiché avec l'interrupteur de la fonctionnalité, au-dessus du trait (réglages principaux). */
  readonly primary?: boolean;
  /**
   * Réglage booléen du même module dont celui-ci dépend : éteint, celui-ci est grisé dans les paramètres. Sa valeur
   * reste enregistrée telle quelle : c'est à l'usage de tenir compte des deux.
   */
  readonly enabledBy?: string;
}

export interface BooleanSetting extends CommonSetting {
  readonly type: 'boolean';
  readonly default: boolean;
}

export interface NumberSetting extends CommonSetting {
  readonly type: 'number';
  readonly default: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  /** Unité affichée après la valeur (« ms », « % »…). */
  readonly unit?: string;
}

/** Une valeur parmi une liste. */
export interface ChoiceSetting extends CommonSetting {
  readonly type: 'choice';
  readonly default: number;
  readonly options: readonly { readonly value: number; readonly label: string }[];
  /**
   * Pastilles (par défaut), ou curseur cranté sur toute la largeur : un cran par option (options croissantes),
   * placé selon sa valeur.
   */
  readonly display?: 'pills' | 'slider';
}

export type SettingDefinition = BooleanSetting | NumberSetting | ChoiceSetting;

/** Réglages d'un module : clé → définition. L'ordre des clés est l'ordre d'affichage. */
export type SettingsSchema = Readonly<Record<string, SettingDefinition>>;

export type SettingValue<D extends SettingDefinition> = D extends BooleanSetting ? boolean : number;

export interface Settings<S extends SettingsSchema = SettingsSchema> {
  readonly schema: S;
  /** Valeur enregistrée si elle est valide, sinon la valeur par défaut (bornée pour un nombre). */
  get<K extends keyof S & string>(key: K): SettingValue<S[K]>;
  set<K extends keyof S & string>(key: K, value: SettingValue<S[K]>): void;
}
