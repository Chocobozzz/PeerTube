import { isUserUsernameValid } from '../helpers'

module.exports = function (sequelize, DataTypes) {
  const Author = sequelize.define('Author',
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
      ],
      classMethods: {
        associate,

        findOrCreateAuthor
      }
    }
  )

  return Author
}

// ---------------------------------------------------------------------------

function associate (models) {
  this.belongsTo(models.Pod, {
    foreignKey: {
      name: 'podId',
      allowNull: true
    },
    onDelete: 'cascade'
  })

  this.belongsTo(models.User, {
    foreignKey: {
      name: 'userId',
      allowNull: true
    },
    onDelete: 'cascade'
  })
}

function findOrCreateAuthor (name, podId, userId, transaction, callback) {
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

  this.findOrCreate(query).asCallback(function (err, result) {
    if (err) return callback(err)

    // [ instance, wasCreated ]
    return callback(null, result[0])
  })
}
