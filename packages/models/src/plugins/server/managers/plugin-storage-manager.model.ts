export interface PluginStorageManager {
  getData: <T = unknown>(key: string) => Promise<T | undefined>

  storeData: (key: string, data: any) => Promise<any>

  deleteData: (key: string) => Promise<any>
}
