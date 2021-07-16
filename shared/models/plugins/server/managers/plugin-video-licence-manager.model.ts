import { ConstantManager } from '@shared/models/plugins/server/plugin-constant-manager.model'

export interface PluginVideoLicenceManager extends ConstantManager<number> {
  /**
   * @deprecated use `addLicence` instead
   */
  addLicence: (licenceKey: number, licenceLabel: string) => boolean

  /**
   * @deprecated use `deleteLicence` instead
   */
  deleteLicence: (licenceKey: number) => boolean
}
