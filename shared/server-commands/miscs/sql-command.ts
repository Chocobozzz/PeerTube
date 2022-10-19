import { QueryTypes, Sequelize } from 'sequelize'
import { AbstractCommand } from '../shared'

export class SQLCommand extends AbstractCommand {
  private sequelize: Sequelize

  deleteAll (table: string) {
    const seq = this.getSequelize()

    const options = { type: QueryTypes.DELETE }

    return seq.query(`DELETE FROM "${table}"`, options)
  }

  async getCount (table: string) {
    const seq = this.getSequelize()

    const options = { type: QueryTypes.SELECT as QueryTypes.SELECT }

    const [ { total } ] = await seq.query<{ total: string }>(`SELECT COUNT(*) as total FROM "${table}"`, options)
    if (total === null) return 0

    return parseInt(total, 10)
  }

  async getInternalFileUrl (fileId: number) {
    return this.selectQuery(`SELECT "fileUrl" FROM "videoFile" WHERE id = ${fileId}`)
      .then(rows => rows[0].fileUrl as string)
  }

  setActorField (to: string, field: string, value: string) {
    const seq = this.getSequelize()

    const options = { type: QueryTypes.UPDATE }

    return seq.query(`UPDATE actor SET "${field}" = '${value}' WHERE url = '${to}'`, options)
  }

  setVideoField (uuid: string, field: string, value: string) {
    const seq = this.getSequelize()

    const options = { type: QueryTypes.UPDATE }

    return seq.query(`UPDATE video SET "${field}" = '${value}' WHERE uuid = '${uuid}'`, options)
  }

  setPlaylistField (uuid: string, field: string, value: string) {
    const seq = this.getSequelize()

    const options = { type: QueryTypes.UPDATE }

    return seq.query(`UPDATE "videoPlaylist" SET "${field}" = '${value}' WHERE uuid = '${uuid}'`, options)
  }

  async countVideoViewsOf (uuid: string) {
    const seq = this.getSequelize()

    const query = 'SELECT SUM("videoView"."views") AS "total" FROM "videoView" ' +
      `INNER JOIN "video" ON "video"."id" = "videoView"."videoId" WHERE "video"."uuid" = '${uuid}'`

    const options = { type: QueryTypes.SELECT as QueryTypes.SELECT }
    const [ { total } ] = await seq.query<{ total: number }>(query, options)

    if (!total) return 0

    return parseInt(total + '', 10)
  }

  getActorImage (filename: string) {
    return this.selectQuery(`SELECT * FROM "actorImage" WHERE filename = '${filename}'`)
      .then(rows => rows[0])
  }

  selectQuery (query: string) {
    const seq = this.getSequelize()
    const options = { type: QueryTypes.SELECT as QueryTypes.SELECT }

    return seq.query<any>(query, options)
  }

  updateQuery (query: string) {
    const seq = this.getSequelize()
    const options = { type: QueryTypes.UPDATE as QueryTypes.UPDATE }

    return seq.query(query, options)
  }

  setPluginField (pluginName: string, field: string, value: string) {
    const seq = this.getSequelize()

    const options = { type: QueryTypes.UPDATE }

    return seq.query(`UPDATE "plugin" SET "${field}" = '${value}' WHERE "name" = '${pluginName}'`, options)
  }

  setPluginVersion (pluginName: string, newVersion: string) {
    return this.setPluginField(pluginName, 'version', newVersion)
  }

  setPluginLatestVersion (pluginName: string, newVersion: string) {
    return this.setPluginField(pluginName, 'latestVersion', newVersion)
  }

  setActorFollowScores (newScore: number) {
    const seq = this.getSequelize()

    const options = { type: QueryTypes.UPDATE }

    return seq.query(`UPDATE "actorFollow" SET "score" = ${newScore}`, options)
  }

  setTokenField (accessToken: string, field: string, value: string) {
    const seq = this.getSequelize()

    const options = { type: QueryTypes.UPDATE }

    return seq.query(`UPDATE "oAuthToken" SET "${field}" = '${value}' WHERE "accessToken" = '${accessToken}'`, options)
  }

  async cleanup () {
    if (!this.sequelize) return

    await this.sequelize.close()
    this.sequelize = undefined
  }

  private getSequelize () {
    if (this.sequelize) return this.sequelize

    const dbname = 'peertube_test' + this.server.internalServerNumber
    const username = 'peertube'
    const password = 'peertube'
    const host = 'localhost'
    const port = 5432

    this.sequelize = new Sequelize(dbname, username, password, {
      dialect: 'postgres',
      host,
      port,
      logging: false
    })

    return this.sequelize
  }

}
