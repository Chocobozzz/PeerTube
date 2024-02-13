import { VideoChapterObject } from '@peertube/peertube-models'
import { MVideo, MVideoChapter } from '@server/types/models/index.js'

export function buildChaptersAPHasPart (video: MVideo, chapters: MVideoChapter[]) {
  const hasPart: VideoChapterObject[] = []

  if (chapters.length !== 0) {
    for (let i = 0; i < chapters.length - 1; i++) {
      hasPart.push(chapters[i].toActivityPubJSON({ video, nextChapter: chapters[i + 1] }))
    }

    hasPart.push(chapters[chapters.length - 1].toActivityPubJSON({ video, nextChapter: null }))
  }

  return hasPart
}
