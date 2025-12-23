import { ActivityPubActor, ActorImageType, ActorImageType_Type } from '@peertube/peertube-models'
import { isAccountActor, isChannelActor } from '@server/helpers/actors.js'
import { logger, loggerTagsFactory, LoggerTagsFn } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { ServerModel } from '@server/models/server/server.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { MAccount, MActor, MActorFull, MActorFullActor, MActorImages, MChannel, MServer } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { upsertAPPlayerSettings } from '../../player-settings.js'
import { updateActorImages } from '../image.js'
import { getActorAttributesFromObject, getActorDisplayNameFromObject, getImagesInfoFromObject } from './object-to-model-attributes.js'
import { fetchActorFollowsCount } from './url-to-object.js'

export class APActorCreator {
  private readonly lTags: LoggerTagsFn

  constructor (
    private readonly actorObject: ActivityPubActor,
    private readonly ownerActor?: MActorFullActor
  ) {
    this.lTags = loggerTagsFactory('ap', 'actor', 'create', this.actorObject.id)
  }

  async create (): Promise<MActorFull> {
    logger.debug('Creating remote actor from object', { actorObject: this.actorObject, ...this.lTags() })

    const { followersCount, followingCount } = await fetchActorFollowsCount(this.actorObject)

    const actor = await sequelizeTypescript.transaction(async t => {
      const actorInstance = new ActorModel(getActorAttributesFromObject(this.actorObject, followersCount, followingCount)) as MActorFull

      const server = await this.setServer(actorInstance, t)

      const existingActor = await ActorModel.loadByUniqueKeys({
        preferredUsername: actorInstance.preferredUsername,
        url: actorInstance.url,
        serverId: actorInstance.serverId,
        transaction: t
      })

      if (existingActor) {
        logger.debug(`Actor ${existingActor.id} already exists, updating existing one`, this.lTags())

        // Re-init unique keys
        existingActor.preferredUsername = actorInstance.preferredUsername
        existingActor.url = actorInstance.url
        existingActor.serverId = actorInstance.serverId

        await existingActor.save({ transaction: t })

        return ActorModel.loadFull(existingActor.id, t)
      }

      if (isAccountActor(this.actorObject.type)) {
        const account = await this.saveAccount(actorInstance, t)
        await actorInstance.save({ transaction: t })

        actorInstance.Account = Object.assign(account, { Actor: actorInstance })
      } else if (isChannelActor(this.actorObject.type)) {
        const channel = await this.saveVideoChannel(actorInstance, t)
        await actorInstance.save({ transaction: t })

        actorInstance.VideoChannel = Object.assign(channel, { Account: this.ownerActor.Account })
      }

      await this.setImageIfNeeded(actorInstance, ActorImageType.AVATAR, t)
      await this.setImageIfNeeded(actorInstance, ActorImageType.BANNER, t)

      actorInstance.Server = server

      return actorInstance
    })

    if (isChannelActor(actor.type) && typeof this.actorObject.playerSettings === 'string') {
      const channel = Object.assign(actor.VideoChannel, { Actor: actor })

      await upsertAPPlayerSettings({
        settingsObject: this.actorObject.playerSettings,
        video: undefined,
        channel,
        contextUrl: actor.url
      })
    }

    return actor
  }

  private async setServer (actor: MActor, t: Transaction) {
    const actorHost = new URL(actor.url).host

    const serverOptions = {
      where: {
        host: actorHost
      },
      defaults: {
        host: actorHost
      },
      transaction: t
    }
    const [ server ] = await ServerModel.findOrCreate(serverOptions)

    // Save our new account in database
    actor.serverId = server.id

    return server as MServer
  }

  private async setImageIfNeeded (actor: MActor, type: ActorImageType_Type, t: Transaction) {
    const imagesInfo = getImagesInfoFromObject(this.actorObject, type)
    if (imagesInfo.length === 0) return

    return updateActorImages(actor as MActorImages, type, imagesInfo, t)
  }

  private async saveAccount (actor: MActor, t: Transaction) {
    const accountCreated = await AccountModel.create({
      name: getActorDisplayNameFromObject(this.actorObject),
      description: this.actorObject.summary
    }, { transaction: t })

    actor.accountId = accountCreated.id

    return accountCreated as MAccount
  }

  private async saveVideoChannel (actor: MActor, t: Transaction) {
    const videoChannelCreated = await VideoChannelModel.create({
      name: getActorDisplayNameFromObject(this.actorObject),
      description: this.actorObject.summary,
      support: this.actorObject.support,
      accountId: this.ownerActor.Account.id
    }, { transaction: t })

    actor.videoChannelId = videoChannelCreated.id

    return videoChannelCreated as MChannel
  }
}
