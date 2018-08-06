import * as Sequelize from 'sequelize'
import { Migration } from '../../models/migrations'
import { CONSTRAINTS_FIELDS } from '../index'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  {
    const data = {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    } as Migration.String
    await utils.queryInterface.changeColumn('videoImport', 'targetUrl', data)
  }

  {
    const data = {
      type: Sequelize.STRING(CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL.max),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoImport', 'magnetUri', data)
  }

  {
    const data = {
      type: Sequelize.STRING(CONSTRAINTS_FIELDS.VIDEO_IMPORTS.TORRENT_NAME.max),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoImport', 'torrentName', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
