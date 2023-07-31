import { ConstantManager } from '../plugin-constant-manager.model.js'

export interface PluginVideoCategoryManager extends ConstantManager<number> {
  /**
   * @deprecated use `addConstant` instead
   */
  addCategory: (categoryKey: number, categoryLabel: string) => boolean

  /**
   * @deprecated use `deleteConstant` instead
   */
  deleteCategory: (categoryKey: number) => boolean
}
