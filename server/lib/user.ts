import { database as db } from '../initializers'
import { UserInstance } from '../models'
import { addVideoAuthorToFriends } from './friends'
import { createVideoChannel } from './video-channel'

async function createUserAuthorAndChannel (user: UserInstance, validateUser = true) {
  const res = await db.sequelize.transaction(async t => {
    const userOptions = {
      transaction: t,
      validate: validateUser
    }

    const userCreated = await user.save(userOptions)
    const authorInstance = db.Author.build({
      name: userCreated.username,
      podId: null, // It is our pod
      userId: userCreated.id
    })

    const authorCreated = await authorInstance.save({ transaction: t })

    const remoteVideoAuthor = authorCreated.toAddRemoteJSON()

    // Now we'll add the video channel's meta data to our friends
    const author = await addVideoAuthorToFriends(remoteVideoAuthor, t)

    const videoChannelInfo = {
      name: `Default ${userCreated.username} channel`
    }
    const videoChannel = await createVideoChannel(videoChannelInfo, authorCreated, t)

    return { author, videoChannel }
  })

  return res
}

// ---------------------------------------------------------------------------

export {
  createUserAuthorAndChannel
}
