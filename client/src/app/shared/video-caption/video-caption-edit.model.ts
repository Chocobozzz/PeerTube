export interface VideoCaptionEdit {
  language: {
    id: string
    label?: string
  }

  action?: 'CREATE' | 'REMOVE'
  captionfile?: any
}
