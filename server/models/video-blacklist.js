'use strict'

const modelUtils = require('./utils')

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const BlacklistedVideo = sequelize.define('BlacklistedVideo',
    {},
    {
      indexes: [
        {
          fields: [ 'videoId' ],
          unique: true
        }
      ],
      classMethods: {
        associate,

        countTotal,
        list,
        listForApi,
        loadById,
        loadByVideoId
      },
      instanceMethods: {
        toFormatedJSON
      },
      hooks: {}
    }
  )

  return BlacklistedVideo
}

// ------------------------------ METHODS ------------------------------

function toFormatedJSON () {
  return {
    id: this.id,
    videoId: this.videoId,
    createdAt: this.createdAt
  }
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  this.belongsTo(models.Video, {
    foreignKey: 'videoId',
    onDelete: 'cascade'
  })
}

function countTotal (callback) {
  return this.count().asCallback(callback)
}

function list (callback) {
  return this.findAll().asCallback(callback)
}

function listForApi (start, count, sort, callback) {
  const query = {
    offset: start,
    limit: count,
    order: [ modelUtils.getSort(sort) ]
  }

  return this.findAndCountAll(query).asCallback(function (err, result) {
    if (err) return callback(err)

    return callback(null, result.rows, result.count)
  })
}

function loadById (id, callback) {
  return this.findById(id).asCallback(callback)
}

function loadByVideoId (id, callback) {
  const query = {
    where: {
      videoId: id
    }
  }

  return this.find(query).asCallback(callback)
}
