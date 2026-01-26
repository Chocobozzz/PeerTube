export interface VideoCaptionEdit {
  language: {
    id: string
    label?: string
  }

  automaticallyGenerated?: boolean

  action?: 'CREATE' | 'REMOVE' | 'UPDATE'
  captionfile?: any
  updatedAt?: string
}

export type VideoCaptionWithPathEdit = VideoCaptionEdit & { fileUrl?: string }
