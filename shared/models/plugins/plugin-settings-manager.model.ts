export interface PluginSettingsManager {
  getSetting: (name: string) => Promise<string | boolean>

  getSettings: (names: string[]) => Promise<{ [settingName: string]: string | boolean }>

  setSetting: (name: string, value: string) => Promise<any>

  onSettingsChange: (cb: (names: string[]) => void) => void
}
