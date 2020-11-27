export interface RegisterClientFormFieldOptions {
  name: string
  label: string
  type: 'input' | 'input-checkbox' | 'input-password' | 'input-textarea' | 'markdown-text' | 'markdown-enhanced'

  descriptionHTML?: string

  // Default setting value
  default?: string | boolean
}

export interface RegisterClientVideoFieldOptions {
  type: 'import-url' | 'import-torrent' | 'update' | 'upload'
}
