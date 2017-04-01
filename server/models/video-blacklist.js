'use strict'

const modelUtils = require('./utils')

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const Blacklist = sequelize.define('BlacklistedVideo',
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
        loadById
      },
      instanceMethods: {
        toFormatedJSON
      },
      hooks: {}
    }
  )

  return Blacklist
}


// ------------------------------ METHODS ------------------------------

function toFormatedJSON () {
  return {
    remoteId: this.remoteId,
    localId: this.localId,
    createdAt: this.createdAt
  }
}


// ------------------------------ STATICS ------------------------------

function associate (models) {
}

function countTotal (callback) {
  return this.count().asCallback(callback)
}

function list (callback) {
  return this.find().asCallback(callback)
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

function loadByAdmin (adminId, callback) {
  const query = {
    where: {
      blacklistedBy: adminId
    }
  }

  return this.findAll(query).asCallback(callback)
}
