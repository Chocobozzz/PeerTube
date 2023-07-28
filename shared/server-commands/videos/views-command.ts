/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */
import { HttpStatusCode, VideoViewEvent } from '@shared/models'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class ViewsCommand extends AbstractCommand {

  view (options: OverrideCommandOptions & {
    id: number | string
    currentTime: number
    viewEvent?: VideoViewEvent
    xForwardedFor?: string
  }) {
    const { id, xForwardedFor, viewEvent, currentTime } = options
    const path = '/api/v1/videos/' + id + '/views'

    return this.postBodyRequest({
      ...options,

      path,
      xForwardedFor,
      fields: {
        currentTime,
        viewEvent
      },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  async simulateView (options: OverrideCommandOptions & {
    id: number | string
    xForwardedFor?: string
  }) {
    await this.view({ ...options, currentTime: 0 })
    await this.view({ ...options, currentTime: 5 })
  }

  async simulateViewer (options: OverrideCommandOptions & {
    id: number | string
    currentTimes: number[]
    xForwardedFor?: string
  }) {
    let viewEvent: VideoViewEvent = 'seek'

    for (const currentTime of options.currentTimes) {
      await this.view({ ...options, currentTime, viewEvent })

      viewEvent = undefined
    }
  }
}
