import { QueryTypes, Sequelize } from 'sequelize'
import { ServerInfo } from '../server/servers'

const sequelizes: { [ id: number ]: Sequelize } = {}

function getSequelize (internalServerNumber: number) {
  if (sequelizes[internalServerNumber]) return sequelizes[internalServerNumber]

  const dbname = 'peertube_test' + internalServerNumber
  const username = 'peertube'
  const password = 'peertube'
  const host = 'localhost'
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

function deleteAll (internalServerNumber: number, table: string) {
  const seq = getSequelize(internalServerNumber)

  const options = { type: QueryTypes.DELETE }

  return seq.query(`DELETE FROM "${table}"`, options)
}

async function getCount (internalServerNumber: number, table: string) {
  const seq = getSequelize(internalServerNumber)

  const options = { type: QueryTypes.SELECT as QueryTypes.SELECT }

  const [ { total } ] = await seq.query<{ total: string }>(`SELECT COUNT(*) as total FROM "${table}"`, options)
  if (total === null) return 0

  return parseInt(total, 10)
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

function getActorImage (internalServerNumber: number, filename: string) {
  return selectQuery(internalServerNumber, `SELECT * FROM "actorImage" WHERE filename = '${filename}'`)
    .then(rows => rows[0])
}

function selectQuery (internalServerNumber: number, query: string) {
  const seq = getSequelize(internalServerNumber)
  const options = { type: QueryTypes.SELECT as QueryTypes.SELECT }

  return seq.query<any>(query, options)
}

function updateQuery (internalServerNumber: number, query: string) {
  const seq = getSequelize(internalServerNumber)
  const options = { type: QueryTypes.UPDATE as QueryTypes.UPDATE }

  return seq.query(query, options)
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

function setPluginField (internalServerNumber: number, pluginName: string, field: string, value: string) {
  const seq = getSequelize(internalServerNumber)

  const options = { type: QueryTypes.UPDATE }

  return seq.query(`UPDATE "plugin" SET "${field}" = '${value}' WHERE "name" = '${pluginName}'`, options)
}

function setPluginVersion (internalServerNumber: number, pluginName: string, newVersion: string) {
  return setPluginField(internalServerNumber, pluginName, 'version', newVersion)
}

function setPluginLatestVersion (internalServerNumber: number, pluginName: string, newVersion: string) {
  return setPluginField(internalServerNumber, pluginName, 'latestVersion', newVersion)
}

function setActorFollowScores (internalServerNumber: number, newScore: number) {
  const seq = getSequelize(internalServerNumber)

  const options = { type: QueryTypes.UPDATE }

  return seq.query(`UPDATE "actorFollow" SET "score" = ${newScore}`, options)
}

function setTokenField (internalServerNumber: number, accessToken: string, field: string, value: string) {
  const seq = getSequelize(internalServerNumber)

  const options = { type: QueryTypes.UPDATE }

  return seq.query(`UPDATE "oAuthToken" SET "${field}" = '${value}' WHERE "accessToken" = '${accessToken}'`, options)
}

export {
  setVideoField,
  setPlaylistField,
  setActorField,
  countVideoViewsOf,
  setPluginVersion,
  setPluginLatestVersion,
  selectQuery,
  getActorImage,
  deleteAll,
  setTokenField,
  updateQuery,
  setActorFollowScores,
  closeAllSequelize,
  getCount
}
