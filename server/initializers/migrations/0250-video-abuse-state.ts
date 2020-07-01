import * as Sequelize from 'sequelize'
import { AbuseState } from '../../../shared/models'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoAbuse', 'state', data)
  }

  {
    const query = 'UPDATE "videoAbuse" SET "state" = ' + AbuseState.PENDING
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('videoAbuse', 'state', data)
  }

  {
    const data = {
      type: Sequelize.STRING(300),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoAbuse', 'moderationComment', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
