import { HttpStatusCode, VideoEmbedPrivacy, VideoEmbedPrivacyAllowed, VideoEmbedPrivacyUpdate } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class VideoEmbedPrivacyCommand extends AbstractCommand {
  get (
    options: OverrideCommandOptions & {
      videoId: number | string
    }
  ) {
    const { videoId } = options
    const path = '/api/v1/videos/' + videoId + '/embed-privacy'

    return this.getRequestBody<VideoEmbedPrivacy>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  isDomainAllowed (
    options: OverrideCommandOptions & {
      videoId: number | string
      domain: string
    }
  ) {
    const { videoId } = options
    const path = '/api/v1/videos/' + videoId + '/embed-privacy/allowed'

    return this.getRequestBody<VideoEmbedPrivacyAllowed>({
      ...options,

      path,
      query: { domain: options.domain },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  update (
    options: OverrideCommandOptions & VideoEmbedPrivacyUpdate & {
      videoId: number | string
    }
  ) {
    const { videoId, policy, domains } = options
    const path = '/api/v1/videos/' + videoId + '/embed-privacy'

    return this.putBodyRequest({
      ...options,
      path,
      fields: { policy, domains },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
