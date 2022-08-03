import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const { transaction } = utils

  {
    const data = {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('application', 'nodeVersion', data, { transaction })
  }

  {
    const data = {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('application', 'nodeABIVersion', data, { transaction })
  }

  {
    const query = `UPDATE "application" SET "nodeVersion" = '${process.version}'`
    await utils.sequelize.query(query, { transaction })
  }

  {
    const nodeABIVersion = parseInt(process.versions.modules)
    const query = `UPDATE "application" SET "nodeABIVersion" = ${nodeABIVersion}`
    await utils.sequelize.query(query, { transaction })
  }

  {
    const data = {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('application', 'nodeVersion', data, { transaction })
  }

  {
    const data = {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('application', 'nodeABIVersion', data, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
