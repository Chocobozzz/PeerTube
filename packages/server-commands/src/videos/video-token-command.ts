/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { HttpStatusCode, VideoToken } from '@peertube/peertube-models'
import { unwrapBody } from '../requests/index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class VideoTokenCommand extends AbstractCommand {

  create (options: OverrideCommandOptions & {
    videoId: number | string
    videoPassword?: string
  }) {
    const { videoId, videoPassword } = options
    const path = '/api/v1/videos/' + videoId + '/token'

    return unwrapBody<VideoToken>(this.postBodyRequest({
      ...options,
      headers: this.buildVideoPasswordHeader(videoPassword),

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  async getVideoFileToken (options: OverrideCommandOptions & {
    videoId: number | string
    videoPassword?: string
  }) {
    const { files } = await this.create(options)

    return files.token
  }
}
