import * as Sequelize from 'sequelize'

function getSequelize (serverNumber: number) {
  const dbname = 'peertube_test' + serverNumber
  const username = 'peertube'
  const password = 'peertube'
  const host = 'localhost'
  const port = 5432

  return new Sequelize(dbname, username, password, {
    dialect: 'postgres',
    host,
    port,
    operatorsAliases: false,
    logging: false
  })
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

export {
  setVideoField,
  setActorField
}
