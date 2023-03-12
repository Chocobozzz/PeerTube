
import { HttpStatusCode, ResultList } from '@shared/models'
import { VideoImport, VideoImportCreate } from '../../models/videos'
import { unwrapBody } from '../requests'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class ImportsCommand extends AbstractCommand {

  importVideo (options: OverrideCommandOptions & {
    attributes: (VideoImportCreate | { torrentfile?: string, previewfile?: string, thumbnailfile?: string })
  }) {
    const { attributes } = options
    const path = '/api/v1/videos/imports'

    let attaches: any = {}
    if (attributes.torrentfile) attaches = { torrentfile: attributes.torrentfile }
    if (attributes.thumbnailfile) attaches = { thumbnailfile: attributes.thumbnailfile }
    if (attributes.previewfile) attaches = { previewfile: attributes.previewfile }

    return unwrapBody<VideoImport>(this.postUploadRequest({
      ...options,

      path,
      attaches,
      fields: options.attributes,
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
