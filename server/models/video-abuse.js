'use strict'

const constants = require('../initializers/constants')
const modelUtils = require('./utils')
const customVideosValidators = require('../helpers/custom-validators').videos

module.exports = function (sequelize, DataTypes) {
  const VideoAbuse = sequelize.define('VideoAbuse',
    {
      reporterUsername: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          reporterUsernameValid: function (value) {
            const res = customVideosValidators.isVideoAbuseReporterUsernameValid(value)
            if (res === false) throw new Error('Video abuse reporter username is not valid.')
          }
        }
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          reasonValid: function (value) {
            const res = customVideosValidators.isVideoAbuseReasonValid(value)
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
      ],
      classMethods: {
        associate,

        listForApi
      },
      instanceMethods: {
        toFormatedJSON
      }
    }
  )

  return VideoAbuse
}

// ---------------------------------------------------------------------------

function associate (models) {
  this.belongsTo(models.Pod, {
    foreignKey: {
      name: 'reporterPodId',
      allowNull: true
    },
    onDelete: 'cascade'
  })

  this.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
}

function listForApi (start, count, sort, callback) {
  const query = {
    offset: start,
    limit: count,
    order: [ modelUtils.getSort(sort) ],
    include: [
      {
        model: this.sequelize.models.Pod,
        required: false
      }
    ]
  }

  return this.findAndCountAll(query).asCallback(function (err, result) {
    if (err) return callback(err)

    return callback(null, result.rows, result.count)
  })
}

function toFormatedJSON () {
  let reporterPodHost

  if (this.Pod) {
    reporterPodHost = this.Pod.host
  } else {
    // It means it's our video
    reporterPodHost = constants.CONFIG.WEBSERVER.HOST
  }

  const json = {
    id: this.id,
    reporterPodHost,
    reason: this.reason,
    reporterUsername: this.reporterUsername,
    videoId: this.videoId
  }

  return json
}
