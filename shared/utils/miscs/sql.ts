import * as Sequelize from 'sequelize'

let sequelizes: { [ id: number ]: Sequelize.Sequelize } = {}

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
    operatorsAliases: false,
    logging: false
  })

  sequelizes[serverNumber] = seq

  return seq
}

function setActorField (serverNumber: number, to: string, field: string, value: string) {
  const seq = getSequelize(serverNumber)

  const options = { type: Sequelize.QueryTypes.UPDATE }

  return seq.query(`UPDATE actor SET "${field}" = '${value}' WHERE url = '${to}'`, options)
}

function setVideoField (serverNumber: number, uuid: string, field: string, value: string) {
  const seq = getSequelize(serverNumber)

  const options = { type: Sequelize.QueryTypes.UPDATE }

  return seq.query(`UPDATE video SET "${field}" = '${value}' WHERE uuid = '${uuid}'`, options)
}

function setPlaylistField (serverNumber: number, uuid: string, field: string, value: string) {
  const seq = getSequelize(serverNumber)

  const options = { type: Sequelize.QueryTypes.UPDATE }

  return seq.query(`UPDATE "videoPlaylist" SET "${field}" = '${value}' WHERE uuid = '${uuid}'`, options)
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
  closeAllSequelize
}
