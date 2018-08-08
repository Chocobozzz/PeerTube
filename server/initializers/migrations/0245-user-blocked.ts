import * as Sequelize from 'sequelize'
import { createClient } from 'redis'
import { CONFIG } from '../constants'
import { JobQueue } from '../../lib/job-queue'
import { initDatabaseModels } from '../database'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('user', 'blocked', data)
  }

  {
    const query = 'UPDATE "user" SET "blocked" = false'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('user', 'blocked', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
