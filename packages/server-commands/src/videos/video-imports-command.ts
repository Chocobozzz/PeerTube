import { HttpStatusCode, ResultList, VideoImport, VideoImportCreate } from '@peertube/peertube-models'
import { unwrapBody } from '../requests/index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class VideoImportsCommand extends AbstractCommand {

  async importVideo (options: OverrideCommandOptions & {
    attributes: (Partial<VideoImportCreate> | { torrentfile?: string, previewfile?: string, thumbnailfile?: string })
  }) {
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

  delete (options: OverrideCommandOptions & {
    importId: number
  }) {
    const path = '/api/v1/videos/imports/' + options.importId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  cancel (options: OverrideCommandOptions & {
    importId: number
  }) {
    const path = '/api/v1/videos/imports/' + options.importId + '/cancel'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  getMyVideoImports (options: OverrideCommandOptions & {
    sort?: string
    targetUrl?: string
    videoChannelSyncId?: number
    search?: string
  } = {}) {
    const { sort, targetUrl, videoChannelSyncId, search } = options
    const path = '/api/v1/users/me/videos/imports'

    return this.getRequestBody<ResultList<VideoImport>>({
      ...options,

      path,
      query: { sort, targetUrl, videoChannelSyncId, search },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
