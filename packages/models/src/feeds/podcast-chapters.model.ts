// https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/examples/chapters/jsonChapters.md
export interface PodcastChapters {
  version: string
  chapters: PodcastChapter[]
}

export interface PodcastChapter {
  // In seconds
  startTime: number
  title: string
}
