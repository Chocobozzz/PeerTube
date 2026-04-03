import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.queryInterface.renameTable('videoChangeOwnership', 'changeOwnership', { transaction })
  }

  {
    await utils.sequelize.query(
      `ALTER TABLE "changeOwnership" ` +
        `ADD COLUMN "videoChannelId" INTEGER REFERENCES "videoChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      { transaction }
    )

    await utils.sequelize.query(
      `ALTER TABLE "changeOwnership" ALTER COLUMN "videoId" DROP NOT NULL`,
      { transaction }
    )
  }

  {
    await utils.queryInterface.addColumn('changeOwnership', 'state', {
      type: Sequelize.INTEGER,
      allowNull: true
    }, { transaction })

    await utils.sequelize.query('UPDATE "changeOwnership" SET "state" = 1 WHERE "status" = \'WAITING\'', { transaction })
    await utils.sequelize.query('UPDATE "changeOwnership" SET "state" = 3 WHERE "status" = \'ACCEPTED\'', { transaction })
    await utils.sequelize.query('UPDATE "changeOwnership" SET "state" = 2 WHERE "state" IS NULL', { transaction })

    await utils.queryInterface.changeColumn('changeOwnership', 'state', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    }, { transaction })

    await utils.queryInterface.removeColumn('changeOwnership', 'status', { transaction })
  }
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
