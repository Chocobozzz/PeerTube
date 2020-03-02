import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  const metadata = {
    type: Sequelize.JSONB,
    allowNull: true
  }
  await utils.queryInterface.addColumn('videoFile', 'metadata', metadata)

  const metadataUrl = {
    type: Sequelize.STRING,
    allowNull: true
  }
  await utils.queryInterface.addColumn('videoFile', 'metadataUrl', metadataUrl)

}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
