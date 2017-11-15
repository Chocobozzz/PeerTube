import * as Sequelize from 'sequelize'

import { addMethodsToModel } from '../utils'
import { VideoShareAttributes, VideoShareInstance } from './video-share-interface'

let VideoShare: Sequelize.Model<VideoShareInstance, VideoShareAttributes>

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
    associate
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
