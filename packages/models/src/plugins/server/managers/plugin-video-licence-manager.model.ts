import { ConstantManager } from '../plugin-constant-manager.model.js'

export interface PluginVideoLicenceManager extends ConstantManager<number> {
  /**
   * @deprecated use `addConstant` instead
   */
  addLicence: (licenceKey: number, licenceLabel: string) => boolean

  /**
   * @deprecated use `deleteConstant` instead
   */
  deleteLicence: (licenceKey: number) => boolean
}
