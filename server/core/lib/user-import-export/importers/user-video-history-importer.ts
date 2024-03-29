import { pick } from '@peertube/peertube-core-utils'
import { UserVideoHistoryExportJSON } from '@peertube/peertube-models'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { loadOrCreateVideoIfAllowedForUser } from '@server/lib/model-loaders/video.js'
import { UserVideoHistoryModel } from '@server/models/user/user-video-history.js'
import { AbstractUserImporter } from './abstract-user-importer.js'

type SanitizedObject = Pick<UserVideoHistoryExportJSON['watchedVideos'][0], 'videoUrl' | 'lastTimecode' | 'archiveFiles'>

// eslint-disable-next-line max-len
export class UserVideoHistoryImporter extends AbstractUserImporter <UserVideoHistoryExportJSON, UserVideoHistoryExportJSON['watchedVideos'][0], SanitizedObject> {

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
