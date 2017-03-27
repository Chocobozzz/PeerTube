'use strict'

const waterfall = require('async/waterfall')

// utils = { transaction, queryInterface, sequelize, Sequelize }
exports.up = function (utils, finalCallback) {
  const q = utils.queryInterface
  const Sequelize = utils.Sequelize

  const data = {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0
  }

  waterfall([

    function addLicenceColumn (callback) {
      q.addColumn('Videos', 'licence', data, { transaction: utils.transaction }).asCallback(function (err) {
        return callback(err)
      })
    },

    function nullOnDefault (callback) {
      data.defaultValue = null

      q.changeColumn('Videos', 'licence', data, { transaction: utils.transaction }).asCallback(callback)
    }
  ], finalCallback)
}

exports.down = function (options, callback) {
  throw new Error('Not implemented.')
}
