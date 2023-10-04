import { LiveVideoLatencyMode } from '@peertube/peertube-models'
import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  await utils.queryInterface.addColumn('videoLive', 'latencyMode', {
    type: Sequelize.INTEGER,
    defaultValue: null,
    allowNull: true
  }, { transaction: utils.transaction })

  {
    const query = `UPDATE "videoLive" SET "latencyMode" = ${LiveVideoLatencyMode.DEFAULT}`
    await utils.sequelize.query(query, { type: Sequelize.QueryTypes.UPDATE, transaction: utils.transaction })
  }

  await utils.queryInterface.changeColumn('videoLive', 'latencyMode', {
    type: Sequelize.INTEGER,
    defaultValue: null,
    allowNull: false
  }, { transaction: utils.transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
