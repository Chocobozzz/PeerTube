import * as Sequelize from 'sequelize'

import { addMethodsToModel } from '../utils'
import { VideoChannelShareAttributes, VideoChannelShareInstance } from './video-channel-share-interface'

let VideoChannelShare: Sequelize.Model<VideoChannelShareInstance, VideoChannelShareAttributes>

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  VideoChannelShare = sequelize.define<VideoChannelShareInstance, VideoChannelShareAttributes>('VideoChannelShare',
    { },
    {
      indexes: [
        {
          fields: [ 'accountId' ]
        },
        {
          fields: [ 'videoChannelId' ]
        }
      ]
    }
  )

  const classMethods = [
    associate
  ]
  addMethodsToModel(VideoChannelShare, classMethods)

  return VideoChannelShare
}

// ------------------------------ METHODS ------------------------------

function associate (models) {
  VideoChannelShare.belongsTo(models.Account, {
    foreignKey: {
      name: 'accountId',
      allowNull: false
    },
    onDelete: 'cascade'
  })

  VideoChannelShare.belongsTo(models.VideoChannel, {
    foreignKey: {
      name: 'videoChannelId',
      allowNull: true
    },
    onDelete: 'cascade'
  })
}
