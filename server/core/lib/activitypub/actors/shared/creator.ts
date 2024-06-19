import { Op, Transaction } from 'sequelize'
import { ActivityPubActor, ActorImageType, ActorImageType_Type } from '@peertube/peertube-models'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { ServerModel } from '@server/models/server/server.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import {
  MAccount,
  MAccountDefault,
  MActor,
  MActorFullActor,
  MActorId,
  MActorImages,
  MChannel,
  MServer
} from '@server/types/models/index.js'
import { updateActorImages } from '../image.js'
import { getActorAttributesFromObject, getActorDisplayNameFromObject, getImagesInfoFromObject } from './object-to-model-attributes.js'
import { fetchActorFollowsCount } from './url-to-object.js'
import { isAccountActor, isChannelActor } from '@server/helpers/actors.js'

export class APActorCreator {

  constructor (
    private readonly actorObject: ActivityPubActor,
    private readonly ownerActor?: MActorFullActor
  ) {

  }

  async create (): Promise<MActorFullActor> {
    const { followersCount, followingCount } = await fetchActorFollowsCount(this.actorObject)

    const actorInstance = new ActorModel(getActorAttributesFromObject(this.actorObject, followersCount, followingCount))

    return sequelizeTypescript.transaction(async t => {
      const server = await this.setServer(actorInstance, t)

      const { actorCreated, created } = await this.saveActor(actorInstance, t)

      await this.setImageIfNeeded(actorCreated, ActorImageType.AVATAR, t)
      await this.setImageIfNeeded(actorCreated, ActorImageType.BANNER, t)

      await this.tryToFixActorUrlIfNeeded(actorCreated, actorInstance, created, t)

      if (isAccountActor(actorCreated.type)) {
        actorCreated.Account = await this.saveAccount(actorCreated, t) as MAccountDefault
        actorCreated.Account.Actor = actorCreated
      }

      if (isChannelActor(actorCreated.type)) {
        const channel = await this.saveVideoChannel(actorCreated, t)
        actorCreated.VideoChannel = Object.assign(channel, { Actor: actorCreated, Account: this.ownerActor.Account })
      }

      actorCreated.Server = server

      return actorCreated
    })
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

  private async saveActor (actor: MActor, t: Transaction) {
    // Force the actor creation using findOrCreate() instead of save()
    // Sometimes Sequelize skips the save() when it thinks the instance already exists
    // (which could be false in a retried query)
    const [ actorCreated, created ] = await ActorModel.findOrCreate<MActorFullActor>({
      defaults: actor.toJSON(),
      where: {
        [Op.or]: [
          {
            url: actor.url
          },
          {
            serverId: actor.serverId,
            preferredUsername: actor.preferredUsername
          }
        ]
      },
      transaction: t
    })

    return { actorCreated, created }
  }

  private async tryToFixActorUrlIfNeeded (actorCreated: MActor, newActor: MActor, created: boolean, t: Transaction) {
    // Try to fix non HTTPS accounts of remote instances that fixed their URL afterwards
    if (created !== true && actorCreated.url !== newActor.url) {
      // Only fix http://example.com/account/djidane to https://example.com/account/djidane
      if (actorCreated.url.replace(/^http:\/\//, '') !== newActor.url.replace(/^https:\/\//, '')) {
        throw new Error(`Actor from DB with URL ${actorCreated.url} does not correspond to actor ${newActor.url}`)
      }

      actorCreated.url = newActor.url
      await actorCreated.save({ transaction: t })
    }
  }

  private async saveAccount (actor: MActorId, t: Transaction) {
    const [ accountCreated ] = await AccountModel.findOrCreate({
      defaults: {
        name: getActorDisplayNameFromObject(this.actorObject),
        description: this.actorObject.summary,
        actorId: actor.id
      },
      where: {
        actorId: actor.id
      },
      transaction: t
    })

    return accountCreated as MAccount
  }

  private async saveVideoChannel (actor: MActorId, t: Transaction) {
    const [ videoChannelCreated ] = await VideoChannelModel.findOrCreate({
      defaults: {
        name: getActorDisplayNameFromObject(this.actorObject),
        description: this.actorObject.summary,
        support: this.actorObject.support,
        actorId: actor.id,
        accountId: this.ownerActor.Account.id
      },
      where: {
        actorId: actor.id
      },
      transaction: t
    })

    return videoChannelCreated as MChannel
  }
}
