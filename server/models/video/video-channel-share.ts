import * as Sequelize from 'sequelize'

import { addMethodsToModel } from '../utils'
import { VideoChannelShareAttributes, VideoChannelShareInstance, VideoChannelShareMethods } from './video-channel-share-interface'

let VideoChannelShare: Sequelize.Model<VideoChannelShareInstance, VideoChannelShareAttributes>
let loadAccountsByShare: VideoChannelShareMethods.LoadAccountsByShare
let load: VideoChannelShareMethods.Load

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
    associate,
    load,
    loadAccountsByShare
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

load = function (accountId: number, videoChannelId: number, t: Sequelize.Transaction) {
  return VideoChannelShare.findOne({
    where: {
      accountId,
      videoChannelId
    },
    include: [
      VideoChannelShare['sequelize'].models.Account,
      VideoChannelShare['sequelize'].models.VideoChannel
    ],
    transaction: t
  })
}

loadAccountsByShare = function (videoChannelId: number, t: Sequelize.Transaction) {
  const query = {
    where: {
      videoChannelId
    },
    include: [
      {
        model: VideoChannelShare['sequelize'].models.Account,
        required: true
      }
    ],
    transaction: t
  }

  return VideoChannelShare.findAll(query)
    .then(res => res.map(r => r.Account))
}
