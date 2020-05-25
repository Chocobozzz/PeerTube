import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  // We made a mistake with the migration in 2.2.0-rc.1
  // Docker containers did not include this migration file
  // So we check the table definition and add the column if it does not exist
  const tableDefinition = await utils.queryInterface.describeTable('videoFile')

  if (!tableDefinition['metadata']) {
    const metadata = {
      type: Sequelize.JSONB,
      allowNull: true
    }
    await utils.queryInterface.addColumn('videoFile', 'metadata', metadata)
  }

  if (!tableDefinition['metadataUrl']) {
    const metadataUrl = {
      type: Sequelize.STRING,
      allowNull: true
    }
    await utils.queryInterface.addColumn('videoFile', 'metadataUrl', metadataUrl)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
