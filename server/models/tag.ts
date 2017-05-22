import { each } from 'async'
import * as Sequelize from 'sequelize'

import { addMethodsToModel } from './utils'
import {
  TagClass,
  TagInstance,
  TagAttributes,

  TagMethods
} from './tag-interface'

let Tag: Sequelize.Model<TagInstance, TagAttributes>
let findOrCreateTags: TagMethods.FindOrCreateTags

export default function (sequelize, DataTypes) {
  Tag = sequelize.define('Tag',
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
      ]
    }
  )

  const classMethods = [
    associate,

    findOrCreateTags
  ]
  addMethodsToModel(Tag, classMethods)

  return Tag
}

// ---------------------------------------------------------------------------

function associate (models) {
  Tag.belongsToMany(models.Video, {
    foreignKey: 'tagId',
    through: models.VideoTag,
    onDelete: 'cascade'
  })
}

findOrCreateTags = function (tags, transaction, callback) {
  if (!callback) {
    callback = transaction
    transaction = null
  }

  const tagInstances = []

  each(tags, function (tag, callbackEach) {
    const query: any = {
      where: {
        name: tag
      },
      defaults: {
        name: tag
      }
    }

    if (transaction) query.transaction = transaction

    Tag.findOrCreate(query).asCallback(function (err, res) {
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
