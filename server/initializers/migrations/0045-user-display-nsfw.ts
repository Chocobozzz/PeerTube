// utils = { transaction, queryInterface, sequelize, Sequelize }
function up (utils, finalCallback) {
  const q = utils.queryInterface
  const Sequelize = utils.Sequelize

  const data = {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }

  q.addColumn('Users', 'displayNSFW', data, { transaction: utils.transaction }).asCallback(finalCallback)
}

function down (options, callback) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
