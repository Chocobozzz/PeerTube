import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const q = utils.queryInterface

  const query = 'INSERT INTO "VideoFiles" ("videoId", "resolution", "size", "extname", "infoHash", "createdAt", "updatedAt") ' +
                'SELECT "id" AS "videoId", 0 AS "resolution", 0 AS "size", ' +
                '"extname"::"text"::"enum_VideoFiles_extname" as "extname", "infoHash", "createdAt", "updatedAt" ' +
                'FROM "Videos"'

  return utils.db.VideoFile.sync()
    .then(() => utils.sequelize.query(query))
    .then(() => {
      return q.removeColumn('Videos', 'extname')
    })
    .then(() => {
      return q.removeColumn('Videos', 'infoHash')
    })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
