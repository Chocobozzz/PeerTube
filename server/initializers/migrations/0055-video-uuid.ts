import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'
import { Migration } from '../../models/migrations'

function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const q = utils.queryInterface

  const dataUUID = {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: true
  } as Migration.UUID

  return q.addColumn('Videos', 'uuid', dataUUID)
    .then(() => {
      const query = 'UPDATE "Videos" SET "uuid" = "id" WHERE "remoteId" IS NULL'
      return utils.sequelize.query(query)
    })
    .then(() => {
      const query = 'UPDATE "Videos" SET "uuid" = "remoteId" WHERE "remoteId" IS NOT NULL'
      return utils.sequelize.query(query)
    })
    .then(() => {
      dataUUID.defaultValue = null

      return q.changeColumn('Videos', 'uuid', dataUUID)
    })
    .then(() => {
      return removeForeignKey(utils.sequelize, 'RequestVideoQadus')
    })
    .then(() => {
      return removeForeignKey(utils.sequelize, 'RequestVideoEvents')
    })
    .then(() => {
      return removeForeignKey(utils.sequelize, 'BlacklistedVideos')
    })
    .then(() => {
      return removeForeignKey(utils.sequelize, 'UserVideoRates')
    })
    .then(() => {
      return removeForeignKey(utils.sequelize, 'VideoAbuses')
    })
    .then(() => {
      return removeForeignKey(utils.sequelize, 'VideoTags')
    })
    .then(() => {
      const query = 'ALTER TABLE "Videos" DROP CONSTRAINT "Videos_pkey"'
      return utils.sequelize.query(query)
    })
    .then(() => {
      const query = 'ALTER TABLE "Videos" ADD COLUMN "id2" SERIAL PRIMARY KEY'
      return utils.sequelize.query(query)
    })
    .then(() => {
      return q.renameColumn('Videos', 'id', 'oldId')
    })
    .then(() => {
      return q.renameColumn('Videos', 'id2', 'id')
    })
    .then(() => {
      return changeForeignKey(q, utils.sequelize, 'RequestVideoQadus', false)
    })
    .then(() => {
      return changeForeignKey(q, utils.sequelize, 'RequestVideoEvents', false)
    })
    .then(() => {
      return changeForeignKey(q, utils.sequelize, 'BlacklistedVideos', false)
    })
    .then(() => {
      return changeForeignKey(q, utils.sequelize, 'UserVideoRates', false)
    })
    .then(() => {
      return changeForeignKey(q, utils.sequelize, 'VideoAbuses', false)
    })
    .then(() => {
      return changeForeignKey(q, utils.sequelize, 'VideoTags', true)
    })
    .then(() => {
      return q.removeColumn('Videos', 'oldId')
    })
    .then(() => {
      const dataRemote = {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
      return q.addColumn('Videos', 'remote', dataRemote)
    })
    .then(() => {
      const query = 'UPDATE "Videos" SET "remote" = false WHERE "remoteId" IS NULL'
      return utils.sequelize.query(query)
    })
    .then(() => {
      const query = 'UPDATE "Videos" SET "remote" = true WHERE "remoteId" IS NOT NULL'
      return utils.sequelize.query(query)
    })
    .then(() => {
      return q.removeColumn('Videos', 'remoteId')
    })
}

function down (options) {
  throw new Error('Not implemented.')
}

function removeForeignKey (sequelize: Sequelize.Sequelize, tableName: string) {
  const query = 'ALTER TABLE "' + tableName + '" DROP CONSTRAINT "' + tableName + '_videoId_fkey' + '"'
  return sequelize.query(query)
}

function changeForeignKey (q: Sequelize.QueryInterface, sequelize: Sequelize.Sequelize, tableName: string, allowNull: boolean) {
  const data = {
    type: Sequelize.INTEGER,
    allowNull: true
  }

  return q.addColumn(tableName, 'videoId2', data)
    .then(() => {
      const query = 'UPDATE "' + tableName + '" SET "videoId2" = ' +
                    '(SELECT "id" FROM "Videos" WHERE "' + tableName + '"."videoId" = "Videos"."oldId")'
      return sequelize.query(query)
    })
    .then(() => {
      if (allowNull === false) {
        data.allowNull = false

        return q.changeColumn(tableName, 'videoId2', data)
      }

      return Promise.resolve()
    })
    .then(() => {
      return q.removeColumn(tableName, 'videoId')
    })
    .then(() => {
      return q.renameColumn(tableName, 'videoId2', 'videoId')
    })
    .then(() => {
      return q.addIndex(tableName, [ 'videoId' ])
    })
    .then(() => {
      const constraintName = tableName + '_videoId_fkey'
      const query = 'ALTER TABLE "' + tableName + '" ' +
                    ' ADD CONSTRAINT "' + constraintName + '"' +
                    ' FOREIGN KEY ("videoId") REFERENCES "Videos" ON DELETE CASCADE'

      return sequelize.query(query)
    })
}

export {
  up,
  down
}
