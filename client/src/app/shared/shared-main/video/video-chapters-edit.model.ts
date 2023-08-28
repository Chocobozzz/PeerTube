import { simpleObjectsDeepEqual, sortBy } from '@peertube/peertube-core-utils'
import { VideoChapter } from '@peertube/peertube-models'

export class VideoChaptersEdit {
  private chaptersFromAPI: VideoChapter[] = []

  private chapters: VideoChapter[]

  loadFromAPI (chapters: VideoChapter[]) {
    this.chapters = chapters || []

    this.chaptersFromAPI = chapters
  }

  patch (values: { [ id: string ]: any }) {
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

  hasDuplicateValues () {
    const timecodes = this.chapters.map(c => c.timecode)

    return new Set(timecodes).size !== this.chapters.length
  }

  shouldUpdateAPI () {
    return simpleObjectsDeepEqual(sortBy(this.getChaptersForUpdate(), 'timecode'), this.chaptersFromAPI) !== true
  }
}
