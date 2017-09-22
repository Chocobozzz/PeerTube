import * as Sequelize from 'sequelize'
import { values } from 'lodash'

import { CONSTRAINTS_FIELDS } from '../../initializers'
import {
  isVideoFileResolutionValid,
  isVideoFileSizeValid,
  isVideoFileInfoHashValid
} from '../../helpers'

import { addMethodsToModel } from '../utils'
import {
  VideoFileInstance,
  VideoFileAttributes
} from './video-file-interface'

let VideoFile: Sequelize.Model<VideoFileInstance, VideoFileAttributes>

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  VideoFile = sequelize.define<VideoFileInstance, VideoFileAttributes>('VideoFile',
    {
      resolution: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          resolutionValid: value => {
            const res = isVideoFileResolutionValid(value)
            if (res === false) throw new Error('Video file resolution is not valid.')
          }
        }
      },
      size: {
        type: DataTypes.BIGINT,
        allowNull: false,
        validate: {
          sizeValid: value => {
            const res = isVideoFileSizeValid(value)
            if (res === false) throw new Error('Video file size is not valid.')
          }
        }
      },
      extname: {
        type: DataTypes.ENUM(values(CONSTRAINTS_FIELDS.VIDEOS.EXTNAME)),
        allowNull: false
      },
      infoHash: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          infoHashValid: value => {
            const res = isVideoFileInfoHashValid(value)
            if (res === false) throw new Error('Video file info hash is not valid.')
          }
        }
      }
    },
    {
      indexes: [
        {
          fields: [ 'videoId' ]
        },
        {
          fields: [ 'infoHash' ]
        }
      ]
    }
  )

  const classMethods = [
    associate
  ]
  addMethodsToModel(VideoFile, classMethods)

  return VideoFile
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  VideoFile.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
}

// ------------------------------ METHODS ------------------------------
