export interface PluginVideoCategoryManager {
  addCategory: (categoryKey: number, categoryLabel: string) => boolean

  deleteCategory: (categoryKey: number) => boolean
}
