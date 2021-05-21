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
}

export interface RegisterClientVideoFieldOptions {
  type: 'update' | 'upload' | 'import-url' | 'import-torrent' | 'go-live'
}
