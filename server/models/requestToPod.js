'use strict'

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const RequestToPod = sequelize.define('RequestToPod', {}, {
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
