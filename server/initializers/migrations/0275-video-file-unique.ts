import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  // Delete duplicated keys
  {
    const query = 'DELETE FROM "server" s1 USING "server" s2 WHERE s1.id < s2.id AND s1."host" = s2."host"'
    await utils.sequelize.query(query)
  }

  {
    const query = 'DELETE FROM "videoFile" vf1 USING "videoFile" vf2 WHERE vf1.id < vf2.id ' +
      'AND vf1."videoId" = vf2."videoId" AND vf1.resolution = vf2.resolution AND vf1.fps IS NULL'
    await utils.sequelize.query(query)
  }

  {
    const query = 'UPDATE "videoFile" SET fps = -1 WHERE fps IS NULL;'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: -1
    }
    await utils.queryInterface.changeColumn('videoFile', 'fps', data)
  }

}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
