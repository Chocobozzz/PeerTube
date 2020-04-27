import * as Bluebird from 'bluebird'

export interface PluginSettingsManager {
  getSetting: (name: string) => Bluebird<string | boolean>

  getSettings: (names: string[]) => Bluebird<{ [settingName: string]: string | boolean }>

  setSetting: (name: string, value: string) => Bluebird<any>
}
