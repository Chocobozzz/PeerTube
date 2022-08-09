export interface VideoCaptionEdit {
  language: {
    id: string
    label?: string
  }

  action?: 'CREATE' | 'REMOVE' | 'UPDATE'
  captionfile?: any
  updatedAt?: string
}

export type VideoCaptionWithPathEdit = VideoCaptionEdit & { captionPath?: string }
