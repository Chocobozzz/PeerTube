import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    await utils.queryInterface.addColumn('actorImage', 'actorId', {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true,
      references: {
        model: 'actor',
        key: 'id'
      },
      onDelete: 'CASCADE'
    }, { transaction: utils.transaction })

    const query = 'SELECT id AS "actorId", "avatarId", "bannerId" FROM actor;'
    const rawActors = await utils.sequelize.query(query, { type: Sequelize.QueryTypes.SELECT, transaction: utils.transaction }) as any

    for (const { avatarId, bannerId, actorId } of rawActors) {
      for (const actorImageId of [ avatarId, bannerId ]) {
        await utils.sequelize.query(
          `UPDATE "actorImage" SET "actorId" = ${actorId} WHERE id = ${actorImageId}`,
          { type: Sequelize.QueryTypes.UPDATE, transaction: utils.transaction }
        )
      }
    }

    await utils.queryInterface.changeColumn('actorImage', 'actorId', {
      type: Sequelize.INTEGER,
      allowNull: false
    }, { transaction: utils.transaction })
    await utils.queryInterface.addIndex('actorImage', [ 'actorId', 'type', 'width' ], { unique: true, transaction: utils.transaction })

    await utils.queryInterface.removeColumn('actor', 'avatarId', { transaction: utils.transaction })
    await utils.queryInterface.removeColumn('actor', 'bannerId', { transaction: utils.transaction })
  }
}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
