import { pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode, PlayerChannelSettings, PlayerVideoSettings, PlayerVideoSettingsUpdate } from '@peertube/peertube-models'
import { unwrapBody } from '../requests/requests.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class PlayerSettingsCommand extends AbstractCommand {
  getForVideo (
    options: OverrideCommandOptions & {
      videoId: number | string
      raw?: boolean
      videoPassword?: string
    }
  ) {
    const path = '/api/v1/player-settings/videos/' + options.videoId

    return this.get<PlayerVideoSettings>({ ...options, path })
  }

  getForChannel (
    options: OverrideCommandOptions & {
      channelHandle: string
      raw?: boolean
    }
  ) {
    const path = '/api/v1/player-settings/video-channels/' + options.channelHandle

    return this.get<PlayerChannelSettings>({ ...options, path })
  }

  private get<T = (PlayerVideoSettings | PlayerChannelSettings)> (
    options: OverrideCommandOptions & {
      path: string
      videoPassword?: string

      raw?: boolean
    }
  ) {
    const headers = this.buildVideoPasswordHeader(options.videoPassword)

    return this.getRequestBody<T>({
      ...options,

      headers,

      query: options.raw
        ? { raw: options.raw }
        : undefined,

      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  // ---------------------------------------------------------------------------

  updateForVideo (
    options: OverrideCommandOptions & PlayerVideoSettingsUpdate & {
      videoId: number | string
    }
  ) {
    const path = '/api/v1/player-settings/videos/' + options.videoId

    return this.update<PlayerVideoSettings>({ ...options, path })
  }

  updateForChannel (
    options: OverrideCommandOptions & PlayerVideoSettingsUpdate & {
      channelHandle: string
    }
  ) {
    const path = '/api/v1/player-settings/video-channels/' + options.channelHandle

    return this.update<PlayerChannelSettings>({ ...options, path })
  }

  private update<T = (PlayerVideoSettings | PlayerChannelSettings)> (
    options: OverrideCommandOptions & PlayerVideoSettingsUpdate & {
      path: string
    }
  ) {
    return unwrapBody<T>(this.putBodyRequest({
      ...options,

      fields: pick(options, [ 'theme' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }
}
