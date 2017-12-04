import * as Sequelize from 'sequelize'
import { PeerTubeDatabase } from '../database'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize,
  db: PeerTubeDatabase
}): Promise<void> {
  await utils.db.Avatar.sync()

  const data = {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: 'Avatars',
      key: 'id'
    },
    onDelete: 'CASCADE'
  }
  await utils.queryInterface.addColumn('Accounts', 'avatarId', data)
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
