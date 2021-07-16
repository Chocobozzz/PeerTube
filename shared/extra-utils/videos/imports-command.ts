
import { HttpStatusCode, ResultList } from '@shared/models'
import { VideoImport, VideoImportCreate } from '../../models/videos'
import { unwrapBody } from '../requests'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class ImportsCommand extends AbstractCommand {

  importVideo (options: OverrideCommandOptions & {
    attributes: VideoImportCreate & { torrentfile?: string }
  }) {
    const { attributes } = options
    const path = '/api/v1/videos/imports'

    let attaches: any = {}
    if (attributes.torrentfile) attaches = { torrentfile: attributes.torrentfile }

    return unwrapBody<VideoImport>(this.postUploadRequest({
      ...options,

      path,
      attaches,
      fields: options.attributes,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  getMyVideoImports (options: OverrideCommandOptions & {
    sort?: string
  } = {}) {
    const { sort } = options
    const path = '/api/v1/users/me/videos/imports'

    const query = {}
    if (sort) query['sort'] = sort

    return this.getRequestBody<ResultList<VideoImport>>({
      ...options,

      path,
      query: { sort },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
