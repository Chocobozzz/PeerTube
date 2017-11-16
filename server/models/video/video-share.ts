import * as Sequelize from 'sequelize'

import { addMethodsToModel } from '../utils'
import { VideoShareAttributes, VideoShareInstance, VideoShareMethods } from './video-share-interface'

let VideoShare: Sequelize.Model<VideoShareInstance, VideoShareAttributes>
let loadAccountsByShare: VideoShareMethods.LoadAccountsByShare

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
    loadAccountsByShare
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

loadAccountsByShare = function (videoId: number) {
  const query = {
    where: {
      videoId
    },
    include: [
      {
        model: VideoShare['sequelize'].models.Account,
        required: true
      }
    ]
  }

  return VideoShare.findAll(query)
    .then(res => res.map(r => r.Account))
}
