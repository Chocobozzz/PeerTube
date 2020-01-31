import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null
    }

    await utils.queryInterface.addColumn('thumbnail', 'automaticallyGenerated', data)
  }

  {
    // Set auto generated to true for watch later playlists
    const query = 'UPDATE thumbnail SET "automaticallyGenerated" = true WHERE "videoPlaylistId" IN ' +
      '(SELECT id FROM "videoPlaylist" WHERE type = 2)'

    await utils.sequelize.query(query)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
