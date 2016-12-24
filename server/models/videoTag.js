'use strict'

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const VideoTag = sequelize.define('VideoTag', {}, {})

  return VideoTag
}
