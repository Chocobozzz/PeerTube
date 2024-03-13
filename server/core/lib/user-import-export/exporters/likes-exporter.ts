import { AbstractUserExporter } from './abstract-user-exporter.js'
import { MAccountVideoRateVideoUrl } from '@server/types/models/index.js'
import { ActivityPubOrderedCollection, LikesExportJSON } from '@peertube/peertube-models'
import { AccountVideoRateModel } from '@server/models/account/account-video-rate.js'
import { activityPubCollection } from '@server/lib/activitypub/collection.js'
import { activityPubContextify } from '@server/helpers/activity-pub-utils.js'
import { getContextFilter } from '@server/lib/activitypub/context.js'

export class LikesExporter extends AbstractUserExporter <LikesExportJSON> {

  async export () {
    const likes = await AccountVideoRateModel.listRatesOfAccountIdForExport(this.user.Account.id, 'like')

    return {
      json: {
        likes: this.formatLikesJSON(likes)
      } as LikesExportJSON,

      activityPub: await this.formatLikesAP(likes),

      staticFiles: []
    }
  }

  getActivityPubFilename () {
    return this.activityPubFilenames.likes
  }

  private formatLikesJSON (likes: MAccountVideoRateVideoUrl[]) {
    return likes.map(o => ({ videoUrl: o.Video.url, createdAt: o.createdAt.toISOString() }))
  }

  private formatLikesAP (likes: MAccountVideoRateVideoUrl[]): Promise<ActivityPubOrderedCollection<string>> {
    return activityPubContextify(
      activityPubCollection(this.getActivityPubFilename(), likes.map(l => l.Video.url)),
      'Collection',
      getContextFilter()
    )
  }
}
