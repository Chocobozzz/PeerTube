import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  {
    const data = {
      type: Sequelize.ENUM('do_not_list', 'blur', 'display'),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('user', 'nsfwPolicy', data)
  }

  {
    const query = 'UPDATE "user" SET "nsfwPolicy" = \'do_not_list\''
    await utils.sequelize.query(query)
  }

  {
    const query = 'UPDATE "user" SET "nsfwPolicy" = \'display\' WHERE "displayNSFW" = true'
    await utils.sequelize.query(query)
  }

  {
    const query = 'ALTER TABLE "user" ALTER COLUMN "nsfwPolicy" SET NOT NULL'
    await utils.sequelize.query(query)
  }

  {
    await utils.queryInterface.removeColumn('user', 'displayNSFW')
  }

}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
