import { QueryTypes, Sequelize } from 'sequelize'

let sequelizes: { [ id: number ]: Sequelize } = {}

function getSequelize (serverNumber: number) {
  if (sequelizes[serverNumber]) return sequelizes[serverNumber]

  const dbname = 'peertube_test' + serverNumber
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

  sequelizes[serverNumber] = seq

  return seq
}

function setActorField (serverNumber: number, to: string, field: string, value: string) {
  const seq = getSequelize(serverNumber)

  const options = { type: QueryTypes.UPDATE }

  return seq.query(`UPDATE actor SET "${field}" = '${value}' WHERE url = '${to}'`, options)
}

function setVideoField (serverNumber: number, uuid: string, field: string, value: string) {
  const seq = getSequelize(serverNumber)

  const options = { type: QueryTypes.UPDATE }

  return seq.query(`UPDATE video SET "${field}" = '${value}' WHERE uuid = '${uuid}'`, options)
}

function setPlaylistField (serverNumber: number, uuid: string, field: string, value: string) {
  const seq = getSequelize(serverNumber)

  const options = { type: QueryTypes.UPDATE }

  return seq.query(`UPDATE "videoPlaylist" SET "${field}" = '${value}' WHERE uuid = '${uuid}'`, options)
}

async function countVideoViewsOf (serverNumber: number, uuid: string) {
  const seq = getSequelize(serverNumber)

  // tslint:disable
  const query = `SELECT SUM("videoView"."views") AS "total" FROM "videoView" INNER JOIN "video" ON "video"."id" = "videoView"."videoId" WHERE "video"."uuid" = '${uuid}'`

  const options = { type: QueryTypes.SELECT as QueryTypes.SELECT }
  const [ { total } ] = await seq.query<{ total: number }>(query, options)

  if (!total) return 0

  // FIXME: check if we really need parseInt
  return parseInt(total + '', 10)
}

async function closeAllSequelize (servers: any[]) {
  for (let i = 1; i <= servers.length; i++) {
    if (sequelizes[ i ]) {
      await sequelizes[ i ].close()
      delete sequelizes[ i ]
    }
  }
}

export {
  setVideoField,
  setPlaylistField,
  setActorField,
  countVideoViewsOf,
  closeAllSequelize
}
