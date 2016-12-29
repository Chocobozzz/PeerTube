'use strict'

const each = require('async/each')

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
        associate,

        findOrCreateTags
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

function findOrCreateTags (tags, transaction, callback) {
  if (!callback) {
    callback = transaction
    transaction = null
  }

  const self = this
  const tagInstances = []

  each(tags, function (tag, callbackEach) {
    const query = {
      where: {
        name: tag
      },
      defaults: {
        name: tag
      }
    }

    if (transaction) query.transaction = transaction

    self.findOrCreate(query).asCallback(function (err, res) {
      if (err) return callbackEach(err)

      // res = [ tag, isCreated ]
      const tag = res[0]
      tagInstances.push(tag)
      return callbackEach()
    })
  }, function (err) {
    return callback(err, tagInstances)
  })
}
