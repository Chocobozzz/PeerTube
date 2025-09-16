import { pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode, ResultList, VideoChannelSync, VideoChannelSyncCreate } from '@peertube/peertube-models'
import { unwrapBody } from '../requests/index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class ChannelSyncsCommand extends AbstractCommand {
  private static readonly API_PATH = '/api/v1/video-channel-syncs'

  listByAccount (
    options: OverrideCommandOptions & {
      accountName: string
      start?: number
      count?: number
      sort?: string
      includeCollaborations?: boolean
    }
  ) {
    const { accountName, sort = 'createdAt' } = options

    const path = `/api/v1/accounts/${accountName}/video-channel-syncs`

    return this.getRequestBody<ResultList<VideoChannelSync>>({
      ...options,

      path,
      query: { sort, ...pick(options, [ 'start', 'count', 'includeCollaborations' ]) },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async create (
    options: OverrideCommandOptions & {
      attributes: VideoChannelSyncCreate
    }
  ) {
    return unwrapBody<{ videoChannelSync: VideoChannelSync }>(this.postBodyRequest({
      ...options,

      path: ChannelSyncsCommand.API_PATH,
      fields: options.attributes,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  delete (
    options: OverrideCommandOptions & {
      channelSyncId: number
    }
  ) {
    const path = `${ChannelSyncsCommand.API_PATH}/${options.channelSyncId}`

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
