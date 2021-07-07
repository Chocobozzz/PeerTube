export interface PluginVideoLanguageManager {
  addLanguage: (languageKey: string, languageLabel: string) => boolean

  deleteLanguage: (languageKey: string) => boolean
}
