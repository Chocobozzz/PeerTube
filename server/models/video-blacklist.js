'use strict'

const modelUtils = require('./utils')

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const BlacklistedVideo = sequelize.define('BlacklistedVideo',
    {
      remoteId: {
	type: DataTypes.UUID,
	defaultValue: DataTypes.UUIDV4,
	primaryKey: true,
	validate: {
	  isUUID: 4
	}
      },
      localId: {
        type: DataTypes.UUID,
	defaultValue: DataTypes.UUIDV4,
	allowNull: false,
	validate: {
	  isUUID: 4
	}
      }
    },
    {
      indexes: [
	{
	  fields: [ 'remoteId' ]
	},
        {
          fields: [ 'localId' ],
	  unique: true
        }
      ],
      classMethods: {
        associate,

        countTotal,
        list,
        listForApi,
	loadById,
	loadByPod
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
    remoteId: this.remoteId,
    localId: this.localId,
    remotePodId: this.remotePodId,
    createdAt: this.createdAt
  }
}


// ------------------------------ STATICS ------------------------------

function associate (models) {
  this.belongsTo(models.Pod, {
    foreignKey: 'remotePodId',
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

function loadByPod (remotePodId, callback) {
  const query = {
    where: {
      remotePodId: remotePodId
    }
  }

  return this.findAll(query).asCallback(callback)
}
