import { ActivityPubActor, ActorImageType } from '@peertube/peertube-models'
import { resetSequelizeInstance, runInReadCommittedTransaction } from '@server/helpers/database-utils.js'
import { logger } from '@server/helpers/logger.js'
import { AccountModel } from '@server/models/account/account.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { MAccount, MActor, MActorFull, MChannel } from '@server/types/models/index.js'
import { upsertAPPlayerSettings } from '../player-settings.js'
import { getOrCreateAPOwner } from './get.js'
import { updateActorImages } from './image.js'
import { fetchActorFollowsCount } from './shared/index.js'
import { getImagesInfoFromObject } from './shared/object-to-model-attributes.js'

export class APActorUpdater {
  private readonly accountOrChannel: MAccount | MChannel

  constructor (
    private readonly actorObject: ActivityPubActor,
    private readonly actor: MActorFull
  ) {
    if (this.actorObject.type === 'Group') this.accountOrChannel = this.actor.VideoChannel
    else this.accountOrChannel = this.actor.Account
  }

  async update () {
    const avatarsInfo = getImagesInfoFromObject(this.actorObject, ActorImageType.AVATAR)
    const bannersInfo = getImagesInfoFromObject(this.actorObject, ActorImageType.BANNER)

    try {
      await this.updateActorInstance(this.actor, this.actorObject)

      this.accountOrChannel.name = this.actorObject.name || this.actorObject.preferredUsername
      this.accountOrChannel.description = this.actorObject.summary

      const accountOrChannel = this.accountOrChannel

      if (accountOrChannel instanceof VideoChannelModel) {
        const channel = accountOrChannel as MChannel

        const owner = await getOrCreateAPOwner(this.actorObject, this.actorObject.id)

        channel.accountId = owner.Account.id
        channel.support = this.actorObject.support

        if (typeof this.actorObject.playerSettings === 'string') {
          await upsertAPPlayerSettings({
            settingsObject: this.actorObject.playerSettings,
            video: undefined,
            channel: Object.assign(channel, { Account: owner.Account, Actor: this.actor }),
            contextUrl: this.actor.url
          })
        }
      }

      await runInReadCommittedTransaction(async t => {
        await updateActorImages(this.actor, ActorImageType.BANNER, bannersInfo, t)
        await updateActorImages(this.actor, ActorImageType.AVATAR, avatarsInfo, t)
      })

      await runInReadCommittedTransaction(async t => {
        await this.accountOrChannel.save({ transaction: t })

        if (accountOrChannel instanceof VideoChannelModel) {
          this.actor.videoChannelId = accountOrChannel.id
          this.actor.accountId = null
        } else if (accountOrChannel instanceof AccountModel) {
          this.actor.accountId = accountOrChannel.id
          this.actor.videoChannelId = null
        }

        await this.actor.save({ transaction: t })
      })

      // Update the following line to template string
      logger.info(`Remote account ${this.actorObject.id} updated`)
    } catch (err) {
      if (this.actor !== undefined) {
        await resetSequelizeInstance(this.actor)
      }

      if (this.accountOrChannel !== undefined) {
        await resetSequelizeInstance(this.accountOrChannel)
      }

      // This is just a debug because we will retry the insert
      logger.debug('Cannot update the remote account.', { err })
      throw err
    }
  }

  private async updateActorInstance (actorInstance: MActor, actorObject: ActivityPubActor) {
    const { followersCount, followingCount } = await fetchActorFollowsCount(actorObject)

    actorInstance.type = actorObject.type
    actorInstance.preferredUsername = actorObject.preferredUsername
    actorInstance.url = actorObject.id
    actorInstance.publicKey = actorObject.publicKey.publicKeyPem
    actorInstance.followersCount = followersCount
    actorInstance.followingCount = followingCount
    actorInstance.inboxUrl = actorObject.inbox
    actorInstance.outboxUrl = actorObject.outbox
    actorInstance.followersUrl = actorObject.followers
    actorInstance.followingUrl = actorObject.following

    if (actorObject.published) actorInstance.remoteCreatedAt = new Date(actorObject.published)

    if (actorObject.endpoints?.sharedInbox) {
      actorInstance.sharedInboxUrl = actorObject.endpoints.sharedInbox
    }

    // Force actor update
    actorInstance.changed('updatedAt', true)
  }
}
