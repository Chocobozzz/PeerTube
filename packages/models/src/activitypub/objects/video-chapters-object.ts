export interface VideoChaptersObject {
  id: string
  hasPart: VideoChapterObject[]
}

// Same as https://schema.org/hasPart
export interface VideoChapterObject {
  name: string
  startOffset: number
  endOffset: number
}
