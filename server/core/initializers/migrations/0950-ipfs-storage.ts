import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  // Add IPFS CID column to videoFile table
  {
    const data = {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    }

    await utils.queryInterface.addColumn('videoFile', 'ipfsCid', data, { transaction: utils.transaction })
  }

  // Add IPFS CID column to videoStreamingPlaylist table
  {
    const data = {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    }

    await utils.queryInterface.addColumn('videoStreamingPlaylist', 'ipfsCid', data, { transaction: utils.transaction })
  }

  // Add IPFS CID column to videoCaption table
  {
    const data = {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    }

    await utils.queryInterface.addColumn('videoCaption', 'ipfsCid', data, { transaction: utils.transaction })
  }

  // Add IPFS CID column to videoSource table
  {
    const data = {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    }

    await utils.queryInterface.addColumn('videoSource', 'ipfsCid', data, { transaction: utils.transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
