import { waterfall } from 'async'

// utils = { transaction, queryInterface, sequelize, Sequelize }
function up (utils, finalCallback) {
  const q = utils.queryInterface
  const Sequelize = utils.Sequelize

  const data = {
    type: Sequelize.STRING(400),
    allowNull: false,
    defaultValue: ''
  }

  waterfall([

    function addEmailColumn (callback) {
      q.addColumn('Users', 'email', data, { transaction: utils.transaction }).asCallback(function (err) {
        return callback(err)
      })
    },

    function updateWithFakeEmails (callback) {
      const query = 'UPDATE "Users" SET "email" = CONCAT("username", \'@example.com\')'
      utils.sequelize.query(query, { transaction: utils.transaction }).asCallback(function (err) {
        return callback(err)
      })
    },

    function nullOnDefault (callback) {
      data.defaultValue = null

      q.changeColumn('Users', 'email', data, { transaction: utils.transaction }).asCallback(callback)
    }
  ], finalCallback)
}

function down (options, callback) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
