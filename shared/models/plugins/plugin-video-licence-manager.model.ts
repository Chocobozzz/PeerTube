export interface PluginVideoLicenceManager {
  addLicence: (licenceKey: number, licenceLabel: string) => boolean

  deleteLicence: (licenceKey: number) => boolean
}
