export { defineSettings } from './define';
export {
  featureChoice,
  onSettingsChange,
  readSettings,
  setFeatureChoice,
  SETTINGS_KEY,
  syncSettingsAcrossTabs,
  type StoredSettings,
} from './store';
export type {
  BooleanSetting,
  ChoiceSetting,
  NumberSetting,
  SettingDefinition,
  Settings,
  SettingsSchema,
  SettingValue,
} from './types';
