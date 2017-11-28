import * as Sequelize from 'sequelize'
import { PeerTubeDatabase } from '../database'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize,
  db: PeerTubeDatabase
}): Promise<void> {
  await utils.queryInterface.removeColumn('Servers', 'email')
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
