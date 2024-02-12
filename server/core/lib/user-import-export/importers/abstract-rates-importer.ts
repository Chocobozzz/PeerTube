import { AbstractUserImporter } from './abstract-user-importer.js'
import { VideoRateType } from '@peertube/peertube-models'
import { loadOrCreateVideoIfAllowedForUser } from '@server/lib/model-loaders/video.js'
import { userRateVideo } from '@server/lib/rate.js'
import { VideoModel } from '@server/models/video/video.js'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'

export abstract class AbstractRatesImporter <E, O> extends AbstractUserImporter <E, O> {

  protected sanitizeRate <O extends { videoUrl: string }> (data: O) {
    if (!isUrlValid(data.videoUrl)) return undefined

    return data
  }

  protected async importRate (data: { videoUrl: string }, rateType: VideoRateType) {
    const videoUrl = data.videoUrl
    const videoImmutable = await loadOrCreateVideoIfAllowedForUser(videoUrl)

    if (!videoImmutable) {
      throw new Error(`Cannot get or create video ${videoUrl} to import user ${rateType}`)
    }

    const video = await VideoModel.loadFull(videoImmutable.id)

    await userRateVideo({ account: this.user.Account, rateType, video })

    return { duplicate: false }
  }
}
