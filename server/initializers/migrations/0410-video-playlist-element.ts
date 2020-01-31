import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    }

    await utils.queryInterface.changeColumn('videoPlaylistElement', 'videoId', data)
  }

  await utils.queryInterface.removeConstraint('videoPlaylistElement', 'videoPlaylistElement_videoId_fkey')

  await utils.queryInterface.addConstraint('videoPlaylistElement', [ 'videoId' ], {
    type: 'foreign key',
    references: {
      table: 'video',
      field: 'id'
    },
    onDelete: 'set null',
    onUpdate: 'CASCADE'
  })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
