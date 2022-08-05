import { HttpStatusCode, ResultList, VideoChannelCreateResult, VideoChannelSync, VideoChannelSyncCreate } from "@shared/models"
import { pick } from "lodash"
import { unwrapBody } from "../requests"
import { AbstractCommand, OverrideCommandOptions } from "../shared"

export class ChannelSyncsCommand extends AbstractCommand {
  private static readonly API_PATH = '/api/v1/video-channel-syncs'
  listByAccount (options: OverrideCommandOptions & {
    accountName: string
    start?: number
    count?: number
    sort?: string
  }) {
    const { accountName, sort = 'createdAt' } = options
    const path = `/api/v1/accounts/${accountName}/video-channel-syncs`
    return this.getRequestBody<ResultList<VideoChannelSync>>({
      ...options,

      path,
      query: { sort, ...pick(options, [ 'start', 'count', 'withStats', 'search' ]) },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async create (options: OverrideCommandOptions & {
    attributes: VideoChannelSyncCreate
  }) {
    const response = this.postBodyRequest({
      path: ChannelSyncsCommand.API_PATH,
      ...options,
      fields: options.attributes,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
    const body = await unwrapBody<{ videoChannelSync: VideoChannelCreateResult }>(response)
    return body.videoChannelSync
  }

  delete (options: OverrideCommandOptions & {
    channelSyncId: number
  }) {
    const path = `${ChannelSyncsCommand.API_PATH}/${options.channelSyncId}`

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
