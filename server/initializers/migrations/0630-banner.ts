import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {

  {
    await utils.sequelize.query(`ALTER TABLE "avatar" RENAME to "actorImage"`)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('actorImage', 'type', data)
  }

  {
    await utils.sequelize.query(`UPDATE "actorImage" SET "type" = 1`)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('actorImage', 'type', data)
  }

  {
    await utils.sequelize.query(
      `ALTER TABLE "actor" ADD COLUMN "bannerId" INTEGER REFERENCES "actorImage" ("id") ON DELETE SET NULL ON UPDATE CASCADE`
    )
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
