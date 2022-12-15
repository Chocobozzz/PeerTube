import { buildAbsoluteFixturePath } from '@shared/core-utils'
import { HttpStatusCode, ResultList, VideoCaption } from '@shared/models'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class CaptionsCommand extends AbstractCommand {

  add (options: OverrideCommandOptions & {
    videoId: string | number
    language: string
    fixture: string
    mimeType?: string
  }) {
    const { videoId, language, fixture, mimeType } = options

    const path = '/api/v1/videos/' + videoId + '/captions/' + language

    const captionfile = buildAbsoluteFixturePath(fixture)
    const captionfileAttach = mimeType
      ? [ captionfile, { contentType: mimeType } ]
      : captionfile

    return this.putUploadRequest({
      ...options,

      path,
      fields: {},
      attaches: {
        captionfile: captionfileAttach
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  list (options: OverrideCommandOptions & {
    videoId: string | number
  }) {
    const { videoId } = options
    const path = '/api/v1/videos/' + videoId + '/captions'

    return this.getRequestBody<ResultList<VideoCaption>>({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  delete (options: OverrideCommandOptions & {
    videoId: string | number
    language: string
  }) {
    const { videoId, language } = options
    const path = '/api/v1/videos/' + videoId + '/captions/' + language

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
