import { database as db } from '../initializers'
import { UserInstance } from '../models'
import { addVideoAccountToFriends } from './friends'
import { createVideoChannel } from './video-channel'

async function createUserAccountAndChannel (user: UserInstance, validateUser = true) {
  const res = await db.sequelize.transaction(async t => {
    const userOptions = {
      transaction: t,
      validate: validateUser
    }

    const userCreated = await user.save(userOptions)
    const accountInstance = db.Account.build({
      name: userCreated.username,
      podId: null, // It is our pod
      userId: userCreated.id
    })

    const accountCreated = await accountInstance.save({ transaction: t })

    const remoteVideoAccount = accountCreated.toAddRemoteJSON()

    // Now we'll add the video channel's meta data to our friends
    const account = await addVideoAccountToFriends(remoteVideoAccount, t)

    const videoChannelInfo = {
      name: `Default ${userCreated.username} channel`
    }
    const videoChannel = await createVideoChannel(videoChannelInfo, accountCreated, t)

    return { account, videoChannel }
  })

  return res
}

// ---------------------------------------------------------------------------

export {
  createUserAccountAndChannel
}
