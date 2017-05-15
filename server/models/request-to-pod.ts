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
      removeByRequestIdsAndPod
    }
  })

  return RequestToPod
}

// ---------------------------------------------------------------------------

function removeByRequestIdsAndPod (requestsIds, podId, callback) {
  if (!callback) callback = function () { /* empty */ }

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
