import * as Sequelize from 'sequelize'
import { values } from 'lodash'
import { WEBTORRENT_POLICY_TYPES } from '../constants'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  {
    const data = {
      type: Sequelize.ENUM(values(WEBTORRENT_POLICY_TYPES)),
      allowNull: false,
      defaultValue: 'enable'
    }

    await utils.queryInterface.addColumn('user', 'webTorrentPolicy', data)
  }

}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
