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
}

export interface RegisterClientVideoFieldOptions {
  type: 'import-url' | 'import-torrent' | 'update' | 'upload'
}
