import * as Sequelize from 'sequelize'

import { isUserUsernameValid } from '../../helpers'

import { addMethodsToModel } from '../utils'
import {
  AuthorInstance,
  AuthorAttributes,

  AuthorMethods
} from './author-interface'

let Author: Sequelize.Model<AuthorInstance, AuthorAttributes>
let findOrCreateAuthor: AuthorMethods.FindOrCreateAuthor

export default function defineAuthor (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Author = sequelize.define<AuthorInstance, AuthorAttributes>('Author',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          usernameValid: value => {
            const res = isUserUsernameValid(value)
            if (res === false) throw new Error('Username is not valid.')
          }
        }
      }
    },
    {
      indexes: [
        {
          fields: [ 'name' ]
        },
        {
          fields: [ 'podId' ]
        },
        {
          fields: [ 'userId' ],
          unique: true
        },
        {
          fields: [ 'name', 'podId' ],
          unique: true
        }
      ]
    }
  )

  const classMethods = [ associate, findOrCreateAuthor ]
  addMethodsToModel(Author, classMethods)

  return Author
}

// ---------------------------------------------------------------------------

function associate (models) {
  Author.belongsTo(models.Pod, {
    foreignKey: {
      name: 'podId',
      allowNull: true
    },
    onDelete: 'cascade'
  })

  Author.belongsTo(models.User, {
    foreignKey: {
      name: 'userId',
      allowNull: true
    },
    onDelete: 'cascade'
  })

  Author.hasMany(models.Video, {
    foreignKey: {
      name: 'authorId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
}

findOrCreateAuthor = function (name: string, podId: number, userId: number, transaction: Sequelize.Transaction) {
  const author = {
    name,
    podId,
    userId
  }

  const query: Sequelize.FindOrInitializeOptions<AuthorAttributes> = {
    where: author,
    defaults: author,
    transaction
  }

  return Author.findOrCreate(query).then(([ authorInstance ]) => authorInstance)
}
