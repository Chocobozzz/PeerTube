import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true // make all existing users verified
    }

    await utils.queryInterface.addColumn('user', 'verified', data)
  }

  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false // new users must verify
    }

    await utils.queryInterface.changeColumn('user', 'verified', data)
  }

}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
