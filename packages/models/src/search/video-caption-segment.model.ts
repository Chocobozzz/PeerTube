export interface VideoCaptionSegment {
  videoUUID: string
  videoName: string

  language: string
  automaticallyGenerated: boolean

  // Boundaries of the caption cue the search matched, in milliseconds
  startMs: number
  endMs: number

  // Text of the cue the search matched
  text: string

  // Relevance score: higher is better (postgres ts_rank() of the cue)
  similarity: number
}
