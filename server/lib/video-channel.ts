import * as Sequelize from 'sequelize'

import { addVideoChannelToFriends } from './friends'
import { database as db } from '../initializers'
import { AuthorInstance } from '../models'
import { VideoChannelCreate } from '../../shared/models'

function createVideoChannel (videoChannelInfo: VideoChannelCreate, author: AuthorInstance, t: Sequelize.Transaction) {
  let videoChannelUUID = ''

  const videoChannelData = {
    name: videoChannelInfo.name,
    description: videoChannelInfo.description,
    remote: false,
    authorId: author.id
  }

  const videoChannel = db.VideoChannel.build(videoChannelData)
  const options = { transaction: t }

  return videoChannel.save(options)
    .then(videoChannelCreated => {
      // Do not forget to add Author information to the created video channel
      videoChannelCreated.Author = author
      videoChannelUUID = videoChannelCreated.uuid

      return videoChannelCreated
    })
    .then(videoChannel => {
      const remoteVideoChannel = videoChannel.toAddRemoteJSON()

      // Now we'll add the video channel's meta data to our friends
      return addVideoChannelToFriends(remoteVideoChannel, t)
    })
    .then(() => videoChannelUUID) // Return video channel UUID
}

// ---------------------------------------------------------------------------

export {
  createVideoChannel
}
