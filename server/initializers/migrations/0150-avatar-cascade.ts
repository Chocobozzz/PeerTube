import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.queryInterface.removeConstraint('actor', 'actor_avatarId_fkey')

  await utils.queryInterface.addConstraint('actor', [ 'avatarId' ], {
    type: 'foreign key',
    references: {
      table: 'avatar',
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
