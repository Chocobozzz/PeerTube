import { AbstractUserExporter } from './abstract-user-exporter.js'
import { MAccountVideoRateVideoUrl } from '@server/types/models/index.js'
import { AccountVideoRateModel } from '@server/models/account/account-video-rate.js'
import { ActivityPubOrderedCollection, DislikesExportJSON } from '@peertube/peertube-models'
import { activityPubCollection } from '@server/lib/activitypub/collection.js'
import { getContextFilter } from '@server/lib/activitypub/context.js'
import { activityPubContextify } from '@server/helpers/activity-pub-utils.js'

export class DislikesExporter extends AbstractUserExporter <DislikesExportJSON> {

  async export () {
    const dislikes = await AccountVideoRateModel.listRatesOfAccountIdForExport(this.user.Account.id, 'dislike')

    return {
      json: {
        dislikes: this.formatDislikesJSON(dislikes)
      } as DislikesExportJSON,

      activityPub: await this.formatDislikesAP(dislikes),

      staticFiles: []
    }
  }

  getActivityPubFilename () {
    return this.activityPubFilenames.dislikes
  }

  private formatDislikesJSON (dislikes: MAccountVideoRateVideoUrl[]) {
    return dislikes.map(o => ({ videoUrl: o.Video.url, createdAt: o.createdAt.toISOString() }))
  }

  private formatDislikesAP (dislikes: MAccountVideoRateVideoUrl[]): Promise<ActivityPubOrderedCollection<string>> {
    return activityPubContextify(
      activityPubCollection(this.getActivityPubFilename(), dislikes.map(l => l.Video.url)),
      'Rate',
      getContextFilter()
    )
  }

}
