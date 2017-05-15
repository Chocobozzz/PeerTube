// utils = { transaction, queryInterface, sequelize, Sequelize }
function up (utils, finalCallback) {
  const q = utils.queryInterface
  const Sequelize = utils.Sequelize

  const data = {
    type: Sequelize.INTEGER,
    allowNull: true,
    defaultValue: null
  }

  q.addColumn('Videos', 'language', data, { transaction: utils.transaction }).asCallback(finalCallback)
}

function down (options, callback) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
