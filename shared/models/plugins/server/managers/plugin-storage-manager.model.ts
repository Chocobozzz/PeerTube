export interface PluginStorageManager {
  getData: (key: string) => Promise<string>

  storeData: (key: string, data: any) => Promise<any>
}
