import * as Sequelize from 'sequelize'

import { CONFIG } from '../../initializers'
import { isVideoAbuseReporterUsernameValid, isVideoAbuseReasonValid } from '../../helpers'

import { addMethodsToModel, getSort } from '../utils'
import {
  VideoAbuseInstance,
  VideoAbuseAttributes,

  VideoAbuseMethods
} from './video-abuse-interface'

let VideoAbuse: Sequelize.Model<VideoAbuseInstance, VideoAbuseAttributes>
let toFormattedJSON: VideoAbuseMethods.ToFormattedJSON
let listForApi: VideoAbuseMethods.ListForApi

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  VideoAbuse = sequelize.define<VideoAbuseInstance, VideoAbuseAttributes>('VideoAbuse',
    {
      reporterUsername: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          reporterUsernameValid: value => {
            const res = isVideoAbuseReporterUsernameValid(value)
            if (res === false) throw new Error('Video abuse reporter username is not valid.')
          }
        }
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          reasonValid: value => {
            const res = isVideoAbuseReasonValid(value)
            if (res === false) throw new Error('Video abuse reason is not valid.')
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
          fields: [ 'reporterServerId' ]
        }
      ]
    }
  )

  const classMethods = [
    associate,

    listForApi
  ]
  const instanceMethods = [
    toFormattedJSON
  ]
  addMethodsToModel(VideoAbuse, classMethods, instanceMethods)

  return VideoAbuse
}

// ------------------------------ METHODS ------------------------------

toFormattedJSON = function (this: VideoAbuseInstance) {
  let reporterServerHost

  if (this.Server) {
    reporterServerHost = this.Server.host
  } else {
    // It means it's our video
    reporterServerHost = CONFIG.WEBSERVER.HOST
  }

  const json = {
    id: this.id,
    reporterServerHost,
    reason: this.reason,
    reporterUsername: this.reporterUsername,
    videoId: this.videoId,
    createdAt: this.createdAt
  }

  return json
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  VideoAbuse.belongsTo(models.Server, {
    foreignKey: {
      name: 'reporterServerId',
      allowNull: true
    },
    onDelete: 'CASCADE'
  })

  VideoAbuse.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
}

listForApi = function (start: number, count: number, sort: string) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSort(sort) ],
    include: [
      {
        model: VideoAbuse['sequelize'].models.Server,
        required: false
      }
    ]
  }

  return VideoAbuse.findAndCountAll(query).then(({ rows, count }) => {
    return { total: count, data: rows }
  })
}
