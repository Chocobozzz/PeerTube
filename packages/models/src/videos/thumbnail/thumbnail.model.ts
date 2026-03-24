export interface Thumbnail {
  height: number
  width: number
  aspectRatio: ThumbnailAspectRatio

  fileUrl: string
}

export type ThumbnailAspectRatio = '16:9' | '16:10' | '4:3' | '5:4' | '1:1'
