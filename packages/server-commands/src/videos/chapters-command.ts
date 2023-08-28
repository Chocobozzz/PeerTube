import { HttpStatusCode, VideoChapter, VideoChapterUpdate } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class ChaptersCommand extends AbstractCommand {

  list (options: OverrideCommandOptions & {
    videoId: string | number
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/chapters'

    return this.getRequestBody<{ chapters: VideoChapter[] }>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  update (options: OverrideCommandOptions & VideoChapterUpdate & {
    videoId: number | string
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/chapters'

    return this.putBodyRequest({
      ...options,

      path,
      fields: {
        chapters: options.chapters
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
