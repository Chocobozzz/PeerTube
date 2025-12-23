import { simpleObjectsDeepEqual, sortBy } from '@peertube/peertube-core-utils'
import { VideoChapter } from '@peertube/peertube-models'

export class VideoChaptersEdit {
  private chaptersFromAPI: VideoChapter[] = []
  private chapters: VideoChapter[] = []

  loadFromAPI (chapters: VideoChapter[]) {
    this.chapters = chapters || []

    this.chaptersFromAPI = chapters
  }

  loadFromForm (values: { chapters?: { timecode?: number, title?: string }[] }) {
    const chapters = values.chapters || []

    this.chapters = chapters.map((c: any) => {
      return {
        timecode: c.timecode || 0,
        title: c.title
      }
    })
  }

  toFormPatch () {
    return { chapters: this.chapters }
  }

  getChaptersForUpdate (): VideoChapter[] {
    return this.chapters.filter(c => !!c.title)
  }

  hasChanges () {
    return simpleObjectsDeepEqual(sortBy(this.getChaptersForUpdate(), 'timecode'), this.chaptersFromAPI) !== true
  }
}
