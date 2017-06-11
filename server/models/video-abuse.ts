import * as Sequelize from 'sequelize'

import { CONFIG } from '../initializers'
import { isVideoAbuseReporterUsernameValid, isVideoAbuseReasonValid } from '../helpers'

import { addMethodsToModel, getSort } from './utils'
import {
  VideoAbuseClass,
  VideoAbuseInstance,
  VideoAbuseAttributes,

  VideoAbuseMethods
} from './video-abuse-interface'

let VideoAbuse: Sequelize.Model<VideoAbuseInstance, VideoAbuseAttributes>
let listForApi: VideoAbuseMethods.ListForApi

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  VideoAbuse = sequelize.define<VideoAbuseInstance, VideoAbuseAttributes>('VideoAbuse',
    {
      reporterUsername: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          reporterUsernameValid: function (value) {
            const res = isVideoAbuseReporterUsernameValid(value)
            if (res === false) throw new Error('Video abuse reporter username is not valid.')
          }
        }
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          reasonValid: function (value) {
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
          fields: [ 'reporterPodId' ]
        }
      ]
    }
  )

  const classMethods = [
    associate,

    listForApi
  ]
  const instanceMethods = [
    toFormatedJSON
  ]
  addMethodsToModel(VideoAbuse, classMethods, instanceMethods)

  return VideoAbuse
}

// ------------------------------ METHODS ------------------------------

function toFormatedJSON () {
  let reporterPodHost

  if (this.Pod) {
    reporterPodHost = this.Pod.host
  } else {
    // It means it's our video
    reporterPodHost = CONFIG.WEBSERVER.HOST
  }

  const json = {
    id: this.id,
    reporterPodHost,
    reason: this.reason,
    reporterUsername: this.reporterUsername,
    videoId: this.videoId,
    createdAt: this.createdAt
  }

  return json
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  VideoAbuse.belongsTo(models.Pod, {
    foreignKey: {
      name: 'reporterPodId',
      allowNull: true
    },
    onDelete: 'cascade'
  })

  VideoAbuse.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
}

listForApi = function (start, count, sort, callback) {
  const query = {
    offset: start,
    limit: count,
    order: [ getSort(sort) ],
    include: [
      {
        model: VideoAbuse['sequelize'].models.Pod,
        required: false
      }
    ]
  }

  return VideoAbuse.findAndCountAll(query).asCallback(function (err, result) {
    if (err) return callback(err)

    return callback(null, result.rows, result.count)
  })
}


