import { waterfall } from 'async'

// utils = { transaction, queryInterface, sequelize, Sequelize }
function up (utils, finalCallback) {
  const q = utils.queryInterface
  const Sequelize = utils.Sequelize

  const data = {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0
  }

  waterfall([

    function addCategoryColumn (callback) {
      q.addColumn('Videos', 'category', data, { transaction: utils.transaction }).asCallback(function (err) {
        return callback(err)
      })
    },

    function nullOnDefault (callback) {
      data.defaultValue = null

      q.changeColumn('Videos', 'category', data, { transaction: utils.transaction }).asCallback(callback)
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
