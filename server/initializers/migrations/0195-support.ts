import * as Sequelize from 'sequelize'
import { CONSTRAINTS_FIELDS } from '../index'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const data = {
      type: Sequelize.STRING(CONSTRAINTS_FIELDS.VIDEOS.SUPPORT.max),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('video', 'support', data)
  }

  {
    const data = {
      type: Sequelize.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNELS.SUPPORT.max),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoChannel', 'support', data)
  }

  {
    const data = {
      type: Sequelize.STRING(CONSTRAINTS_FIELDS.USERS.DESCRIPTION.max),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('account', 'description', data)
  }

  {
    const data = {
      type: Sequelize.STRING(CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('video', 'description', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
