import { pick } from '@peertube/peertube-core-utils'
import {
  ActorFollow,
  HttpStatusCode,
  ResultList,
  VideoChannel,
  VideoChannelActivity,
  VideoChannelCreate,
  VideoChannelCreateResult,
  VideoChannelUpdate,
  VideosImportInChannelCreate
} from '@peertube/peertube-models'
import { unwrapBody } from '../requests/index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class ChannelsCommand extends AbstractCommand {
  list (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string
    withStats?: boolean
  } = {}) {
    const path = '/api/v1/video-channels'

    return this.getRequestBody<ResultList<VideoChannel>>({
      ...options,

      path,
      query: pick(options, [ 'start', 'count', 'sort', 'withStats' ]),
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listByAccount (
    options: OverrideCommandOptions & {
      accountName: string
      start?: number
      count?: number
      sort?: string
      withStats?: boolean
      search?: string
      includeCollaborations?: boolean
    }
  ) {
    const { accountName, sort = 'createdAt' } = options
    const path = '/api/v1/accounts/' + accountName + '/video-channels'

    return this.getRequestBody<ResultList<VideoChannel>>({
      ...options,

      path,
      query: { sort, ...pick(options, [ 'start', 'count', 'withStats', 'search', 'includeCollaborations' ]) },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async create (
    options: OverrideCommandOptions & {
      attributes: Partial<VideoChannelCreate>
    }
  ) {
    const path = '/api/v1/video-channels/'

    // Default attributes
    const defaultAttributes = {
      displayName: 'my super video channel',
      description: 'my super channel description',
      support: 'my super channel support'
    }
    const attributes = { ...defaultAttributes, ...options.attributes }

    const body = await unwrapBody<{ videoChannel: VideoChannelCreateResult }>(this.postBodyRequest({
      ...options,

      path,
      fields: attributes,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))

    return body.videoChannel
  }

  update (
    options: OverrideCommandOptions & {
      channelName: string
      attributes: VideoChannelUpdate
    }
  ) {
    const { channelName, attributes } = options
    const path = '/api/v1/video-channels/' + channelName

    return this.putBodyRequest({
      ...options,

      path,
      fields: attributes,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  delete (
    options: OverrideCommandOptions & {
      channelName: string
    }
  ) {
    const path = '/api/v1/video-channels/' + options.channelName

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  get (
    options: OverrideCommandOptions & {
      channelName: string
    }
  ) {
    const path = '/api/v1/video-channels/' + options.channelName

    return this.getRequestBody<VideoChannel>({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async getIdOf (
    options: OverrideCommandOptions & {
      channelName: string
    }
  ) {
    const { id } = await this.get(options)

    return id
  }

  async getDefaultId (options: OverrideCommandOptions) {
    const { videoChannels } = await this.server.users.getMyInfo(options)

    return videoChannels[0].id
  }

  // ---------------------------------------------------------------------------

  updateImage (
    options: OverrideCommandOptions & {
      fixture?: string
      channelName: string | number
      type: 'avatar' | 'banner'
    }
  ) {
    const { channelName, type } = options

    let fixture = options.fixture

    if (!fixture) {
      if (type === 'avatar') fixture = 'avatar.png'
      else fixture = 'banner.jpg'
    }

    const path = `/api/v1/video-channels/${channelName}/${type}/pick`

    return this.updateImageRequest({
      ...options,

      path,
      fixture,
      fieldname: type + 'file',

      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  deleteImage (
    options: OverrideCommandOptions & {
      channelName: string | number
      type: 'avatar' | 'banner'
    }
  ) {
    const { channelName, type } = options

    const path = `/api/v1/video-channels/${channelName}/${type}`

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  listFollowers (
    options: OverrideCommandOptions & {
      channelName: string
      start?: number
      count?: number
      sort?: string
      search?: string
    }
  ) {
    const { channelName, start, count, sort, search } = options
    const path = '/api/v1/video-channels/' + channelName + '/followers'

    const query = { start, count, sort, search }

    return this.getRequestBody<ResultList<ActorFollow>>({
      ...options,

      path,
      query,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listActivities (
    options: OverrideCommandOptions & {
      channelName: string
      start?: number
      count?: number
      sort?: string
    }
  ) {
    const { channelName, start, count, sort } = options
    const path = '/api/v1/video-channels/' + channelName + '/activities'

    const query = { start, count, sort }

    return this.getRequestBody<ResultList<VideoChannelActivity>>({
      ...options,

      path,
      query,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  importVideos (
    options: OverrideCommandOptions & VideosImportInChannelCreate & {
      channelName: string
    }
  ) {
    const { channelName, externalChannelUrl, videoChannelSyncId } = options

    const path = `/api/v1/video-channels/${channelName}/import-videos`

    return this.postBodyRequest({
      ...options,

      path,
      fields: { externalChannelUrl, videoChannelSyncId },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
