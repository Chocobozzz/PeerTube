import * as Sequelize from 'sequelize'
import { getActivityPubUrl } from '../helpers/activitypub'
import { createPrivateAndPublicKeys } from '../helpers/peertube-crypto'
import { database as db } from '../initializers'
import { CONFIG } from '../initializers/constants'
import { UserInstance } from '../models'
import { createVideoChannel } from './video-channel'

async function createUserAccountAndChannel (user: UserInstance, validateUser = true) {
  const res = await db.sequelize.transaction(async t => {
    const userOptions = {
      transaction: t,
      validate: validateUser
    }

    const userCreated = await user.save(userOptions)
    const accountCreated = await createLocalAccount(user.username, user.id, null, t)

    const videoChannelInfo = {
      name: `Default ${userCreated.username} channel`
    }
    const videoChannel = await createVideoChannel(videoChannelInfo, accountCreated, t)

    return { account: accountCreated, videoChannel }
  })

  return res
}

async function createLocalAccount (name: string, userId: number, applicationId: number, t: Sequelize.Transaction) {
  const { publicKey, privateKey } = await createPrivateAndPublicKeys()
  const url = getActivityPubUrl('account', name)

  const accountInstance = db.Account.build({
    name,
    url,
    publicKey,
    privateKey,
    followersCount: 0,
    followingCount: 0,
    inboxUrl: url + '/inbox',
    outboxUrl: url + '/outbox',
    sharedInboxUrl: CONFIG.WEBSERVER.URL + '/inbox',
    followersUrl: url + '/followers',
    followingUrl: url + '/following',
    userId,
    applicationId,
    podId: null // It is our pod
  })

  return accountInstance.save({ transaction: t })
}

// ---------------------------------------------------------------------------

export {
  createUserAccountAndChannel,
  createLocalAccount
}
