import { database as db } from '../initializers'
import { UserInstance } from '../models'
import { addVideoAuthorToFriends } from './friends'
import { createVideoChannel } from './video-channel'

function createUserAuthorAndChannel (user: UserInstance, validateUser = true) {
  return db.sequelize.transaction(t => {
    const userOptions = {
      transaction: t,
      validate: validateUser
    }

    return user.save(userOptions)
      .then(user => {
        const author = db.Author.build({
          name: user.username,
          podId: null, // It is our pod
          userId: user.id
        })

        return author.save({ transaction: t })
          .then(author => ({ author, user }))
      })
      .then(({ author, user }) => {
        const remoteVideoAuthor = author.toAddRemoteJSON()

        // Now we'll add the video channel's meta data to our friends
        return addVideoAuthorToFriends(remoteVideoAuthor, t)
          .then(() => ({ author, user }))
      })
      .then(({ author, user }) => {
        const videoChannelInfo = {
          name: `Default ${user.username} channel`
        }

        return createVideoChannel(videoChannelInfo, author, t)
          .then(videoChannel => ({ author, user, videoChannel }))
      })
  })
}

// ---------------------------------------------------------------------------

export {
  createUserAuthorAndChannel
}
