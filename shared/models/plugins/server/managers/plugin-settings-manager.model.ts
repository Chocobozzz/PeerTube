export type SettingValue = string | boolean

export interface SettingEntries {
  [settingName: string]: SettingValue
}

export type SettingsChangeCallback = (settings: SettingEntries) => Promise<any>

export interface PluginSettingsManager {
  getSetting: (name: string) => Promise<SettingValue>

  getSettings: (names: string[]) => Promise<SettingEntries>

  setSetting: (name: string, value: SettingValue) => Promise<any>

  onSettingsChange: (cb: SettingsChangeCallback) => void
}
