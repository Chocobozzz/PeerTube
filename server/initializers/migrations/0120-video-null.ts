import * as Sequelize from 'sequelize'
import { CONSTRAINTS_FIELDS } from '../constants'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize,
  db: any
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
      type: Sequelize.STRING(CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max),
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
