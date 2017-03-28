'use strict'

const waterfall = require('async/waterfall')

// utils = { transaction, queryInterface, sequelize, Sequelize }
exports.up = function (utils, finalCallback) {
  const q = utils.queryInterface
  const Sequelize = utils.Sequelize

  const data = {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }

  waterfall([

    function addNSFWColumn (callback) {
      q.addColumn('Videos', 'nsfw', data, { transaction: utils.transaction }).asCallback(function (err) {
        return callback(err)
      })
    },

    function nullOnDefault (callback) {
      data.defaultValue = null

      q.changeColumn('Videos', 'nsfw', data, { transaction: utils.transaction }).asCallback(callback)
    }
  ], finalCallback)
}

exports.down = function (options, callback) {
  throw new Error('Not implemented.')
}
