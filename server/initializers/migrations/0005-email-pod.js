/*
  This is just an example.
*/

// utils = { transaction, queryInterface }
exports.up = function (utils, callback) {
  const q = utils.queryInterface
  const Sequelize = utils.Sequelize

  const data = {
    type: Sequelize.STRING(400),
    allowNull: false
  }

  q.addColumn('Pods', 'email', data, { transaction: utils.transaction }).asCallback(callback)
}

exports.down = function (options, callback) {
  throw new Error('Not implemented.')
}
