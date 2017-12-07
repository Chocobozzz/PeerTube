import * as Sequelize from 'sequelize'
import { PeerTubeDatabase } from '../database'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize,
  db: PeerTubeDatabase
}): Promise<void> {

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('Videos', 'licence', data)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('Videos', 'category', data)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('Videos', 'description', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
