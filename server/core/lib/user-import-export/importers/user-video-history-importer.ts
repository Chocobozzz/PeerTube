import { UserVideoHistoryExportJSON } from '@peertube/peertube-models'
import { AbstractRatesImporter } from './abstract-rates-importer.js'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { pick } from '@peertube/peertube-core-utils'
import { loadOrCreateVideoIfAllowedForUser } from '@server/lib/model-loaders/video.js'
import { UserVideoHistoryModel } from '@server/models/user/user-video-history.js'

type SanitizedObject = Pick<UserVideoHistoryExportJSON['watchedVideos'][0], 'videoUrl' | 'lastTimecode'>

// eslint-disable-next-line max-len
export class UserVideoHistoryImporter extends AbstractRatesImporter <UserVideoHistoryExportJSON, UserVideoHistoryExportJSON['watchedVideos'][0]> {

  protected getImportObjects (json: UserVideoHistoryExportJSON) {
    return json.watchedVideos
  }

  protected sanitize (data: UserVideoHistoryExportJSON['watchedVideos'][0]) {
    if (!isUrlValid(data.videoUrl)) return undefined

    return pick(data, [ 'videoUrl', 'lastTimecode' ])
  }

  protected async importObject (data: SanitizedObject) {
    if (!this.user.videosHistoryEnabled) return { duplicate: false }

    const videoUrl = data.videoUrl
    const videoImmutable = await loadOrCreateVideoIfAllowedForUser(videoUrl)

    if (!videoImmutable) {
      throw new Error(`Cannot get or create video ${videoUrl} to import user history`)
    }

    await UserVideoHistoryModel.upsert({
      videoId: videoImmutable.id,
      userId: this.user.id,
      currentTime: data.lastTimecode
    })

    return { duplicate: false }
  }
}
