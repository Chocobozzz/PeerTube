import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    // We'll add a unique index on filename, so delete duplicates or PeerTube won't start
    const query = 'DELETE FROM "avatar" s1 ' +
      'USING (SELECT MIN(id) as id, filename FROM "avatar" GROUP BY "filename" HAVING COUNT(*) > 1) s2 ' +
      'WHERE s1."filename" = s2."filename" AND s1.id <> s2.id'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    }

    await utils.queryInterface.addColumn('avatar', 'fileUrl', data)
  }

  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null
    }

    await utils.queryInterface.addColumn('avatar', 'onDisk', data)
  }

  {
    const query = 'UPDATE "avatar" SET "onDisk" = true;'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: null
    }

    await utils.queryInterface.changeColumn('avatar', 'onDisk', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
