import { ChangeOwnership, ChangeOwnershipStateType, HttpStatusCode, ResultList } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class ChangeOwnershipCommand extends AbstractCommand {
  // ---------------------------------------------------------------------------
  // Video ownership change
  // ---------------------------------------------------------------------------

  createVideo (
    options: OverrideCommandOptions & {
      videoId: number | string
      username: string
    }
  ) {
    const { videoId, username } = options
    const path = '/api/v1/videos/' + videoId + '/give-ownership'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { username },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  listVideos (options: OverrideCommandOptions & {
    sort?: string
    start?: number
    count?: number
  } = {}) {
    const path = '/api/v1/videos/ownership'

    return this.getRequestBody<ResultList<ChangeOwnership>>({
      ...options,

      path,
      query: { sort: options.sort ?? '-createdAt', start: options.start, count: options.count },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listOfVideo (
    options: OverrideCommandOptions & {
      videoId: number | string
      state?: ChangeOwnershipStateType
    }
  ) {
    const { videoId, state } = options
    const path = '/api/v1/videos/' + videoId + '/ownership'

    return this.getRequestBody<ResultList<ChangeOwnership>>({
      ...options,

      path,
      query: { state, sort: '-createdAt' },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  acceptVideo (
    options: OverrideCommandOptions & {
      ownershipId: number
      channelId: number
    }
  ) {
    const { ownershipId, channelId } = options
    const path = '/api/v1/videos/ownership/' + ownershipId + '/accept'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { channelId },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  refuseVideo (
    options: OverrideCommandOptions & {
      ownershipId: number
    }
  ) {
    const { ownershipId } = options
    const path = '/api/v1/videos/ownership/' + ownershipId + '/refuse'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  deleteVideo (
    options: OverrideCommandOptions & {
      ownershipId: number
    }
  ) {
    const { ownershipId } = options
    const path = '/api/v1/videos/ownership/' + ownershipId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------
  // Channel ownership change
  // ---------------------------------------------------------------------------

  createChannel (
    options: OverrideCommandOptions & {
      channelName: string
      username: string
    }
  ) {
    const { channelName, username } = options
    const path = '/api/v1/video-channels/' + channelName + '/give-ownership'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { username },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  listChannels (options: OverrideCommandOptions & {
    sort?: string
    start?: number
    count?: number
  } = {}) {
    const path = '/api/v1/video-channels/ownership'

    return this.getRequestBody<ResultList<ChangeOwnership>>({
      ...options,

      path,
      query: { sort: options.sort ?? '-createdAt', start: options.start, count: options.count },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listOfChannel (
    options: OverrideCommandOptions & {
      channelName: string
      state?: ChangeOwnershipStateType
    }
  ) {
    const { channelName, state } = options
    const path = '/api/v1/video-channels/' + channelName + '/ownership'

    return this.getRequestBody<ResultList<ChangeOwnership>>({
      ...options,

      path,
      query: { state, sort: '-createdAt' },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  acceptChannel (
    options: OverrideCommandOptions & {
      ownershipId: number
    }
  ) {
    const { ownershipId } = options
    const path = '/api/v1/video-channels/ownership/' + ownershipId + '/accept'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  refuseChannel (
    options: OverrideCommandOptions & {
      ownershipId: number
    }
  ) {
    const { ownershipId } = options
    const path = '/api/v1/video-channels/ownership/' + ownershipId + '/refuse'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  deleteChannel (
    options: OverrideCommandOptions & {
      ownershipId: number
    }
  ) {
    const { ownershipId } = options
    const path = '/api/v1/video-channels/ownership/' + ownershipId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
