import { AccountExportJSON, ActivityPubActor, ActorImageType } from '@peertube/peertube-models'
import { MAccountDefault, MActorDefaultBanner } from '@server/types/models/index.js'
import { ActorExporter } from './actor-exporter.js'
import { AccountModel } from '@server/models/account/account.js'
import { getContextFilter } from '@server/lib/activitypub/context.js'
import { activityPubContextify } from '@server/helpers/activity-pub-utils.js'
import { join } from 'path'

export class AccountExporter extends ActorExporter <AccountExportJSON> {

  async export () {
    const account = await AccountModel.loadLocalByName(this.user.username)

    const { staticFiles, relativePathsFromJSON } = this.exportActorFiles(account.Actor as MActorDefaultBanner)

    return {
      json: this.exportAccountJSON(account, relativePathsFromJSON),
      staticFiles,
      activityPub: await this.exportAccountAP(account)
    }
  }

  getActivityPubFilename () {
    return this.activityPubFilenames.account
  }

  // ---------------------------------------------------------------------------

  private exportAccountJSON (account: MAccountDefault, archiveFiles: { avatar: string }): AccountExportJSON {
    return {
      ...this.exportActorJSON(account.Actor as MActorDefaultBanner),

      displayName: account.getDisplayName(),
      description: account.description,

      updatedAt: account.updatedAt.toISOString(),
      createdAt: account.createdAt.toISOString(),

      archiveFiles
    }
  }

  private async exportAccountAP (account: MAccountDefault): Promise<ActivityPubActor> {
    const avatar = account.Actor.getMaxQualityImage(ActorImageType.AVATAR)

    return activityPubContextify(
      {
        ...await account.toActivityPubObject(),

        likes: this.activityPubFilenames.likes,
        dislikes: this.activityPubFilenames.dislikes,
        outbox: this.activityPubFilenames.outbox,
        following: this.activityPubFilenames.following,

        icon: avatar
          ? [
            {
              ...avatar.toActivityPubObject(),

              url: join(this.relativeStaticDirPath, this.getAvatarPath(account.Actor, avatar.filename))
            }
          ]
          : []
      },
      'Actor',
      getContextFilter())
  }
}
