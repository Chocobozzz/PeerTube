import { resetSequelizeInstance, runInReadCommittedTransaction } from '@server/helpers/database-utils'
import { logger } from '@server/helpers/logger'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { MAccount, MActor, MActorFull, MChannel } from '@server/types/models'
import { ActivityPubActor, ActorImageType } from '@shared/models'
import { updateActorImageInstance } from './image'
import { fetchActorFollowsCount } from './shared'
import { getImageInfoFromObject } from './shared/object-to-model-attributes'

export class APActorUpdater {

  private accountOrChannel: MAccount | MChannel

  private readonly actorFieldsSave: object
  private readonly accountOrChannelFieldsSave: object

  constructor (
    private readonly actorObject: ActivityPubActor,
    private readonly actor: MActorFull
  ) {
    this.actorFieldsSave = this.actor.toJSON()

    if (this.actorObject.type === 'Group') this.accountOrChannel = this.actor.VideoChannel
    else this.accountOrChannel = this.actor.Account

    this.accountOrChannelFieldsSave = this.accountOrChannel.toJSON()
  }

  async update () {
    const avatarInfo = getImageInfoFromObject(this.actorObject, ActorImageType.AVATAR)
    const bannerInfo = getImageInfoFromObject(this.actorObject, ActorImageType.BANNER)

    try {
      await this.updateActorInstance(this.actor, this.actorObject)

      this.accountOrChannel.name = this.actorObject.name || this.actorObject.preferredUsername
      this.accountOrChannel.description = this.actorObject.summary

      if (this.accountOrChannel instanceof VideoChannelModel) this.accountOrChannel.support = this.actorObject.support

      await runInReadCommittedTransaction(async t => {
        await updateActorImageInstance(this.actor, ActorImageType.AVATAR, avatarInfo, t)
        await updateActorImageInstance(this.actor, ActorImageType.BANNER, bannerInfo, t)
      })

      await runInReadCommittedTransaction(async t => {
        await this.actor.save({ transaction: t })
        await this.accountOrChannel.save({ transaction: t })
      })

      logger.info('Remote account %s updated', this.actorObject.url)
    } catch (err) {
      if (this.actor !== undefined && this.actorFieldsSave !== undefined) {
        resetSequelizeInstance(this.actor, this.actorFieldsSave)
      }

      if (this.accountOrChannel !== undefined && this.accountOrChannelFieldsSave !== undefined) {
        resetSequelizeInstance(this.accountOrChannel, this.accountOrChannelFieldsSave)
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
