/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */
import { pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoView, VideoViewEvent } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class ViewsCommand extends AbstractCommand {
  view (
    options: OverrideCommandOptions & VideoView & {
      id: number | string
      xForwardedFor?: string
    }
  ) {
    const { id, xForwardedFor } = options
    const path = '/api/v1/videos/' + id + '/views'

    return this.postBodyRequest({
      ...options,

      path,
      xForwardedFor,
      fields: pick(options, [ 'currentTime', 'viewEvent', 'sessionId', 'client', 'device', 'operatingSystem' ]),
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  async simulateView (
    options: OverrideCommandOptions & Omit<VideoView, 'currentTime'> & {
      id: number | string
      xForwardedFor?: string
    }
  ) {
    await this.view({ ...options, currentTime: 0 })
    await this.view({ ...options, currentTime: 5 })
  }

  async simulateViewer (
    options: OverrideCommandOptions & {
      id: number | string
      currentTimes: number[]
      xForwardedFor?: string
      sessionId?: string
    }
  ) {
    let viewEvent: VideoViewEvent = 'seek'

    for (const currentTime of options.currentTimes) {
      await this.view({ ...options, currentTime, viewEvent })

      viewEvent = undefined
    }
  }
}
