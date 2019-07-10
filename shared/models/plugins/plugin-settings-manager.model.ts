import * as Bluebird from 'bluebird'

export interface PluginSettingsManager {
  getSetting: (name: string) => Bluebird<string>

  setSetting: (name: string, value: string) => Bluebird<any>
}
