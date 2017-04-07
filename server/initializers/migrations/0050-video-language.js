'use strict'

// utils = { transaction, queryInterface, sequelize, Sequelize }
exports.up = function (utils, finalCallback) {
  const q = utils.queryInterface
  const Sequelize = utils.Sequelize

  const data = {
    type: Sequelize.INTEGER,
    allowNull: true,
    defaultValue: null
  }

  q.addColumn('Videos', 'language', data, { transaction: utils.transaction }).asCallback(finalCallback)
}

exports.down = function (options, callback) {
  throw new Error('Not implemented.')
}
