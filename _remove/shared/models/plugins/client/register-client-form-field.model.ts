export type RegisterClientFormFieldOptions = {
  name?: string
  label?: string
  type: 'input' | 'input-checkbox' | 'input-password' | 'input-textarea' | 'markdown-text' | 'markdown-enhanced' | 'select' | 'html'

  // For select type
  options?: { value: string, label: string }[]

  // For html type
  html?: string

  descriptionHTML?: string

  // Default setting value
  default?: string | boolean

  // Not supported by plugin setting registration, use registerSettingsScript instead
  hidden?: (options: any) => boolean

  // Return undefined | null if there is no error or return a string with the detailed error
  // Not supported by plugin setting registration
  error?: (options: any) => Promise<{ error: boolean, text?: string }>
}

export interface RegisterClientVideoFieldOptions {
  type: 'update' | 'upload' | 'import-url' | 'import-torrent' | 'go-live'

  // Default to 'plugin-settings'
  tab?: 'main' | 'plugin-settings'
}
