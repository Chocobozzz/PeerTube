import * as Sequelize from 'sequelize'
import { ACTOR_FOLLOW_SCORE } from '../constants'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.queryInterface.removeColumn('server', 'score')

  const data = {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: ACTOR_FOLLOW_SCORE.BASE
  }

  await utils.queryInterface.addColumn('actorFollow', 'score', data)

}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
