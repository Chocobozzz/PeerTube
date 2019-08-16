import * as Bluebird from 'bluebird'

export interface PluginStorageManager {
  getData: (key: string) => Bluebird<string>

  storeData: (key: string, data: any) => Bluebird<any>
}
