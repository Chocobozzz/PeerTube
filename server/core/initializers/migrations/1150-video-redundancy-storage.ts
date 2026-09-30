import { FileStorage } from '@peertube/peertube-models'
import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.queryInterface.addColumn('videoRedundancy', 'storage', {
    type: Sequelize.INTEGER,
    allowNull: true,
    defaultValue: FileStorage.FILE_SYSTEM
  }, { transaction })

  await utils.sequelize.query(
    'UPDATE "videoRedundancy" SET "storage" = NULL WHERE "actorId" NOT IN (SELECT "id" FROM "actor" WHERE "serverId" IS NULL)',
    { transaction }
  )

  await utils.queryInterface.changeColumn('videoRedundancy', 'storage', {
    type: Sequelize.INTEGER,
    allowNull: true,
    defaultValue: null
  }, { transaction })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
