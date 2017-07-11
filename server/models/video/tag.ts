import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { addMethodsToModel } from '../utils'
import {
  TagInstance,
  TagAttributes,

  TagMethods
} from './tag-interface'

let Tag: Sequelize.Model<TagInstance, TagAttributes>
let findOrCreateTags: TagMethods.FindOrCreateTags

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Tag = sequelize.define<TagInstance, TagAttributes>('Tag',
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
    onDelete: 'CASCADE'
  })
}

findOrCreateTags = function (tags: string[], transaction: Sequelize.Transaction) {
  const tasks: Promise<TagInstance>[] = []
  tags.forEach(tag => {
    const query: Sequelize.FindOrInitializeOptions<TagAttributes> = {
      where: {
        name: tag
      },
      defaults: {
        name: tag
      }
    }

    if (transaction) query.transaction = transaction

    const promise = Tag.findOrCreate(query).then(([ tagInstance ]) => tagInstance)
    tasks.push(promise)
  })

  return Promise.all(tasks)
}
