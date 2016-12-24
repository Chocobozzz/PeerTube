'use strict'

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const Tag = sequelize.define('Tag',
    {
      name: {
        type: DataTypes.STRING
      }
    },
    {
      classMethods: {
        associate
      }
    }
  )

  return Tag
}

// ---------------------------------------------------------------------------

function associate (models) {
  this.belongsToMany(models.Video, {
    foreignKey: 'tagId',
    through: models.VideoTag,
    onDelete: 'cascade'
  })
}
