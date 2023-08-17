import { ConstantManager } from '../plugin-constant-manager.model.js'

export interface PluginVideoLanguageManager extends ConstantManager<string> {
  /**
   * @deprecated use `addConstant` instead
   */
  addLanguage: (languageKey: string, languageLabel: string) => boolean

  /**
   * @deprecated use `deleteConstant` instead
   */
  deleteLanguage: (languageKey: string) => boolean
}
