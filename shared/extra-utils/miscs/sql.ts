import { QueryTypes, Sequelize } from 'sequelize'
import { ServerInfo } from '../server/servers'

const sequelizes: { [ id: number ]: Sequelize } = {}

function getSequelize (internalServerNumber: number) {
  if (sequelizes[internalServerNumber]) return sequelizes[internalServerNumber]

  const dbname = 'peertube_test' + internalServerNumber
  const username = 'peertube'
  const password = 'peertube'
  const host = process.env.GITLAB_CI ? 'postgres' : 'localhost'
  const port = 5432

  const seq = new Sequelize(dbname, username, password, {
    dialect: 'postgres',
    host,
    port,
    logging: false
  })

  sequelizes[internalServerNumber] = seq

  return seq
}

function setActorField (internalServerNumber: number, to: string, field: string, value: string) {
  const seq = getSequelize(internalServerNumber)

  const options = { type: QueryTypes.UPDATE }

  return seq.query(`UPDATE actor SET "${field}" = '${value}' WHERE url = '${to}'`, options)
}

function setVideoField (internalServerNumber: number, uuid: string, field: string, value: string) {
  const seq = getSequelize(internalServerNumber)

  const options = { type: QueryTypes.UPDATE }

  return seq.query(`UPDATE video SET "${field}" = '${value}' WHERE uuid = '${uuid}'`, options)
}

function setPlaylistField (internalServerNumber: number, uuid: string, field: string, value: string) {
  const seq = getSequelize(internalServerNumber)

  const options = { type: QueryTypes.UPDATE }

  return seq.query(`UPDATE "videoPlaylist" SET "${field}" = '${value}' WHERE uuid = '${uuid}'`, options)
}

async function countVideoViewsOf (internalServerNumber: number, uuid: string) {
  const seq = getSequelize(internalServerNumber)

  // tslint:disable
  const query = 'SELECT SUM("videoView"."views") AS "total" FROM "videoView" ' +
    `INNER JOIN "video" ON "video"."id" = "videoView"."videoId" WHERE "video"."uuid" = '${uuid}'`

  const options = { type: QueryTypes.SELECT as QueryTypes.SELECT }
  const [ { total } ] = await seq.query<{ total: number }>(query, options)

  if (!total) return 0

  return parseInt(total + '', 10)
}

async function closeAllSequelize (servers: ServerInfo[]) {
  for (const server of servers) {
    if (sequelizes[server.internalServerNumber]) {
      await sequelizes[server.internalServerNumber].close()
      // eslint-disable-next-line
      delete sequelizes[server.internalServerNumber]
    }
  }
}

function setPluginVersion (internalServerNumber: number, pluginName: string, newVersion: string) {
  const seq = getSequelize(internalServerNumber)

  const options = { type: QueryTypes.UPDATE }

  return seq.query(`UPDATE "plugin" SET "version" = '${newVersion}' WHERE "name" = '${pluginName}'`, options)
}

function setActorFollowScores (internalServerNumber: number, newScore: number) {
  const seq = getSequelize(internalServerNumber)

  const options = { type: QueryTypes.UPDATE }

  return seq.query(`UPDATE "actorFollow" SET "score" = ${newScore}`, options)
}

export {
  setVideoField,
  setPlaylistField,
  setActorField,
  countVideoViewsOf,
  setPluginVersion,
  setActorFollowScores,
  closeAllSequelize
}
