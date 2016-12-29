'use strict'

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const RequestToPod = sequelize.define('RequestToPod', {}, {
    indexes: [
      {
        fields: [ 'requestId' ]
      },
      {
        fields: [ 'podId' ]
      },
      {
        fields: [ 'requestId', 'podId' ],
        unique: true
      }
    ],
    classMethods: {
      removePodOf
    }
  })

  return RequestToPod
}

// ---------------------------------------------------------------------------

function removePodOf (requestsIds, podId, callback) {
  if (!callback) callback = function () {}

  const query = {
    where: {
      requestId: {
        $in: requestsIds
      },
      podId: podId
    }
  }

  this.destroy(query).asCallback(callback)
}
