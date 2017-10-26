import * as Sequelize from 'sequelize'

import { isUserUsernameValid } from '../../helpers'
import { removeVideoAuthorToFriends } from '../../lib'

import { addMethodsToModel } from '../utils'
import {
  AuthorInstance,
  AuthorAttributes,

  AuthorMethods
} from './author-interface'

let Author: Sequelize.Model<AuthorInstance, AuthorAttributes>
let loadAuthorByPodAndUUID: AuthorMethods.LoadAuthorByPodAndUUID
let load: AuthorMethods.Load
let loadByUUID: AuthorMethods.LoadByUUID
let listOwned: AuthorMethods.ListOwned
let isOwned: AuthorMethods.IsOwned
let toAddRemoteJSON: AuthorMethods.ToAddRemoteJSON

export default function defineAuthor (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Author = sequelize.define<AuthorInstance, AuthorAttributes>('Author',
    {
      uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        validate: {
          isUUID: 4
        }
      },
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
      ],
      hooks: { afterDestroy }
    }
  )

  const classMethods = [
    associate,
    loadAuthorByPodAndUUID,
    load,
    loadByUUID,
    listOwned
  ]
  const instanceMethods = [
    isOwned,
    toAddRemoteJSON
  ]
  addMethodsToModel(Author, classMethods, instanceMethods)

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

  Author.hasMany(models.VideoChannel, {
    foreignKey: {
      name: 'authorId',
      allowNull: false
    },
    onDelete: 'cascade',
    hooks: true
  })
}

function afterDestroy (author: AuthorInstance) {
  if (author.isOwned()) {
    const removeVideoAuthorToFriendsParams = {
      uuid: author.uuid
    }

    return removeVideoAuthorToFriends(removeVideoAuthorToFriendsParams)
  }

  return undefined
}

toAddRemoteJSON = function (this: AuthorInstance) {
  const json = {
    uuid: this.uuid,
    name: this.name
  }

  return json
}

isOwned = function (this: AuthorInstance) {
  return this.podId === null
}

// ------------------------------ STATICS ------------------------------

listOwned = function () {
  const query: Sequelize.FindOptions<AuthorAttributes> = {
    where: {
      podId: null
    }
  }

  return Author.findAll(query)
}

load = function (id: number) {
  return Author.findById(id)
}

loadByUUID = function (uuid: string) {
  const query: Sequelize.FindOptions<AuthorAttributes> = {
    where: {
      uuid
    }
  }

  return Author.findOne(query)
}

loadAuthorByPodAndUUID = function (uuid: string, podId: number, transaction: Sequelize.Transaction) {
  const query: Sequelize.FindOptions<AuthorAttributes> = {
    where: {
      podId,
      uuid
    },
    transaction
  }

  return Author.find(query)
}
