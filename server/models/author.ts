import * as Sequelize from 'sequelize'

import { isUserUsernameValid } from '../helpers'

import { addMethodsToModel } from './utils'
import {
  AuthorClass,
  AuthorInstance,
  AuthorAttributes,

  AuthorMethods
} from './author-interface'

let Author: Sequelize.Model<AuthorInstance, AuthorAttributes>
let findOrCreateAuthor: AuthorMethods.FindOrCreateAuthor

export default function defineAuthor (sequelize: Sequelize.Sequelize, DataTypes) {
  Author = sequelize.define<AuthorInstance, AuthorAttributes>('Author',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          usernameValid: function (value) {
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
}

findOrCreateAuthor = function (name, podId, userId, transaction, callback) {
  if (!callback) {
    callback = transaction
    transaction = null
  }

  const author = {
    name,
    podId,
    userId
  }

  const query: any = {
    where: author,
    defaults: author
  }

  if (transaction) query.transaction = transaction

  Author.findOrCreate(query).asCallback(function (err, result) {
    if (err) return callback(err)

    // [ instance, wasCreated ]
    return callback(null, result[0])
  })
}
