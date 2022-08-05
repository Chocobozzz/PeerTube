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

    // Avatars
    {
      const query = `UPDATE "actorImage" SET "actorId" = (SELECT "id" FROM "actor" WHERE "actor"."avatarId" = "actorImage"."id") ` +
                    `WHERE "type" = 1`
      await utils.sequelize.query(query, { type: Sequelize.QueryTypes.UPDATE, transaction: utils.transaction })
    }

    // Banners
    {
      const query = `UPDATE "actorImage" SET "actorId" = (SELECT "id" FROM "actor" WHERE "actor"."bannerId" = "actorImage"."id") ` +
                    `WHERE "type" = 2`
      await utils.sequelize.query(query, { type: Sequelize.QueryTypes.UPDATE, transaction: utils.transaction })
    }

    // Remove orphans
    {
      const query = `DELETE FROM "actorImage" WHERE id NOT IN (` +
        `SELECT "bannerId" FROM actor WHERE "bannerId" IS NOT NULL ` +
        `UNION select "avatarId" FROM actor WHERE "avatarId" IS NOT NULL` +
      `);`

      await utils.sequelize.query(query, { type: Sequelize.QueryTypes.DELETE, transaction: utils.transaction })
    }

    await utils.queryInterface.changeColumn('actorImage', 'actorId', {
      type: Sequelize.INTEGER,
      allowNull: false
    }, { transaction: utils.transaction })

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
