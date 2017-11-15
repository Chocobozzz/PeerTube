import * as Sequelize from 'sequelize'

import { CONFIG } from '../../initializers'
import { isVideoAbuseReasonValid } from '../../helpers'

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
          fields: [ 'reporterAccountId' ]
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

  if (this.Account.Server) {
    reporterServerHost = this.Account.Server.host
  } else {
    // It means it's our video
    reporterServerHost = CONFIG.WEBSERVER.HOST
  }

  const json = {
    id: this.id,
    reason: this.reason,
    reporterUsername: this.Account.name,
    reporterServerHost,
    videoId: this.Video.id,
    videoUUID: this.Video.uuid,
    videoName: this.Video.name,
    createdAt: this.createdAt
  }

  return json
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  VideoAbuse.belongsTo(models.Account, {
    foreignKey: {
      name: 'reporterAccountId',
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
        model: VideoAbuse['sequelize'].models.Account,
        required: true,
        include: [
          {
            model: VideoAbuse['sequelize'].models.Server,
            required: false
          }
        ]
      },
      {
        model: VideoAbuse['sequelize'].models.Video,
        required: true
      }
    ]
  }

  return VideoAbuse.findAndCountAll(query).then(({ rows, count }) => {
    return { total: count, data: rows }
  })
}
