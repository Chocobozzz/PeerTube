'use strict'

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const Tag = sequelize.define('Tag',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false
      }
    },
    {
      timestamps: false,
      indexes: [
        {
          fields: [ 'name' ],
          unique: true
        }
      ],
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
