'use strict'

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const VideoTag = sequelize.define('VideoTag', {}, {
    indexes: [
      {
        fields: [ 'videoId' ]
      },
      {
        fields: [ 'tagId' ]
      }
    ]
  })

  return VideoTag
}
