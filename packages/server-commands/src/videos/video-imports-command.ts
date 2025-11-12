import { HttpStatusCode, ResultList, VideoImport, VideoImportCreate, VideoImportState } from '@peertube/peertube-models'
import { unwrapBody } from '../requests/index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class VideoImportsCommand extends AbstractCommand {
  async importVideo (
    options: OverrideCommandOptions & {
      attributes: Partial<VideoImportCreate> | { torrentfile?: string, previewfile?: string, thumbnailfile?: string }
    }
  ) {
    const { attributes } = options
    const path = '/api/v1/videos/imports'

    let defaultChannelId = 1

    try {
      const { videoChannels } = await this.server.users.getMyInfo({ token: options.token })
      defaultChannelId = videoChannels[0].id
    } catch (e) { /* empty */ }

    let attaches: any = {}
    if (attributes.torrentfile) attaches = { torrentfile: attributes.torrentfile }
    if (attributes.thumbnailfile) attaches = { thumbnailfile: attributes.thumbnailfile }
    if (attributes.previewfile) attaches = { previewfile: attributes.previewfile }

    return unwrapBody<VideoImport>(this.postUploadRequest({
      ...options,

      path,
      attaches,
      fields: {
        channelId: defaultChannelId,

        ...options.attributes
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  async quickImport (
    options: OverrideCommandOptions & {
      name: string
      targetUrl: string
      channelId?: number
    }
  ) {
    const { name, targetUrl } = options

    const channelId = options.channelId ?? await this.server.channels.getDefaultId(options)

    return this.importVideo({
      ...options,

      attributes: {
        name,
        targetUrl,
        channelId
      }
    })
  }

  // ---------------------------------------------------------------------------

  delete (
    options: OverrideCommandOptions & {
      importId: number
    }
  ) {
    const path = '/api/v1/videos/imports/' + options.importId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  cancel (
    options: OverrideCommandOptions & {
      importId: number
    }
  ) {
    const path = '/api/v1/videos/imports/' + options.importId + '/cancel'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  retry (
    options: OverrideCommandOptions & {
      importId: number
    }
  ) {
    const path = '/api/v1/videos/imports/' + options.importId + '/retry'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  listMyVideoImports (options: OverrideCommandOptions & {
    id?: number
    videoId?: number
    sort?: string
    targetUrl?: string
    videoChannelSyncId?: number
    search?: string
    includeCollaborations?: boolean
  } = {}) {
    const { id, videoId, sort, targetUrl, videoChannelSyncId, search, includeCollaborations } = options
    const path = '/api/v1/users/me/videos/imports'

    return this.getRequestBody<ResultList<VideoImport>>({
      ...options,

      path,
      query: { id, videoId, sort, targetUrl, videoChannelSyncId, search, includeCollaborations },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  // ---------------------------------------------------------------------------

  async getVideoId (
    options: OverrideCommandOptions & {
      importId: number
    }
  ) {
    const { data } = await this.listMyVideoImports(options)

    return data.find(i => i.id === options.importId)?.video?.id
  }

  async cancelAll (options: OverrideCommandOptions = {}) {
    const { data } = await this.listMyVideoImports(options)

    for (const videoImport of data) {
      if (videoImport.state.id === VideoImportState.PENDING) {
        await this.cancel({ ...options, importId: videoImport.id })
      }
    }
  }
}
