import * as Sequelize from 'sequelize'

import { addMethodsToModel } from '../utils'
import { VideoShareAttributes, VideoShareInstance, VideoShareMethods } from './video-share-interface'

let VideoShare: Sequelize.Model<VideoShareInstance, VideoShareAttributes>
let loadAccountsByShare: VideoShareMethods.LoadAccountsByShare
let load: VideoShareMethods.Load

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  VideoShare = sequelize.define<VideoShareInstance, VideoShareAttributes>('VideoShare',
    { },
    {
      indexes: [
        {
          fields: [ 'accountId' ]
        },
        {
          fields: [ 'videoId' ]
        }
      ]
    }
  )

  const classMethods = [
    associate,
    loadAccountsByShare,
    load
  ]
  addMethodsToModel(VideoShare, classMethods)

  return VideoShare
}

// ------------------------------ METHODS ------------------------------

function associate (models) {
  VideoShare.belongsTo(models.Account, {
    foreignKey: {
      name: 'accountId',
      allowNull: false
    },
    onDelete: 'cascade'
  })

  VideoShare.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: true
    },
    onDelete: 'cascade'
  })
}

load = function (accountId: number, videoId: number, t: Sequelize.Transaction) {
  return VideoShare.findOne({
    where: {
      accountId,
      videoId
    },
    include: [
      VideoShare['sequelize'].models.Account
    ],
    transaction: t
  })
}

loadAccountsByShare = function (videoId: number, t: Sequelize.Transaction) {
  const query = {
    where: {
      videoId
    },
    include: [
      {
        model: VideoShare['sequelize'].models.Account,
        required: true
      }
    ],
    transaction: t
  }

  return VideoShare.findAll(query)
    .then(res => res.map(r => r.Account))
}
