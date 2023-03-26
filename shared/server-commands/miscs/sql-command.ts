import { QueryTypes, Sequelize } from 'sequelize'
import { forceNumber } from '@shared/core-utils'
import { AbstractCommand } from '../shared'

export class SQLCommand extends AbstractCommand {
  private sequelize: Sequelize

  deleteAll (table: string) {
    const seq = this.getSequelize()

    const options = { type: QueryTypes.DELETE }

    return seq.query(`DELETE FROM "${table}"`, options)
  }

  async getVideoShareCount () {
    const [ { total } ] = await this.selectQuery<{ total: string }>(`SELECT COUNT(*) as total FROM "videoShare"`)
    if (total === null) return 0

    return parseInt(total, 10)
  }

  async getInternalFileUrl (fileId: number) {
    return this.selectQuery<{ fileUrl: string }>(`SELECT "fileUrl" FROM "videoFile" WHERE id = :fileId`, { fileId })
      .then(rows => rows[0].fileUrl)
  }

  setActorField (to: string, field: string, value: string) {
    return this.updateQuery(`UPDATE actor SET ${this.escapeColumnName(field)} = :value WHERE url = :to`, { value, to })
  }

  setVideoField (uuid: string, field: string, value: string) {
    return this.updateQuery(`UPDATE video SET ${this.escapeColumnName(field)} = :value WHERE uuid = :uuid`, { value, uuid })
  }

  setPlaylistField (uuid: string, field: string, value: string) {
    return this.updateQuery(`UPDATE "videoPlaylist" SET ${this.escapeColumnName(field)} = :value WHERE uuid = :uuid`, { value, uuid })
  }

  async countVideoViewsOf (uuid: string) {
    const query = 'SELECT SUM("videoView"."views") AS "total" FROM "videoView" ' +
      `INNER JOIN "video" ON "video"."id" = "videoView"."videoId" WHERE "video"."uuid" = :uuid`

    const [ { total } ] = await this.selectQuery<{ total: number }>(query, { uuid })
    if (!total) return 0

    return forceNumber(total)
  }

  getActorImage (filename: string) {
    return this.selectQuery<{ width: number, height: number }>(`SELECT * FROM "actorImage" WHERE filename = :filename`, { filename })
      .then(rows => rows[0])
  }

  // ---------------------------------------------------------------------------

  setPluginVersion (pluginName: string, newVersion: string) {
    return this.setPluginField(pluginName, 'version', newVersion)
  }

  setPluginLatestVersion (pluginName: string, newVersion: string) {
    return this.setPluginField(pluginName, 'latestVersion', newVersion)
  }

  setPluginField (pluginName: string, field: string, value: string) {
    return this.updateQuery(
      `UPDATE "plugin" SET ${this.escapeColumnName(field)} = :value WHERE "name" = :pluginName`,
      { pluginName, value }
    )
  }

  // ---------------------------------------------------------------------------

  selectQuery <T extends object> (query: string, replacements: { [id: string]: string | number } = {}) {
    const seq = this.getSequelize()
    const options = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements
    }

    return seq.query<T>(query, options)
  }

  updateQuery (query: string, replacements: { [id: string]: string | number } = {}) {
    const seq = this.getSequelize()
    const options = { type: QueryTypes.UPDATE as QueryTypes.UPDATE, replacements }

    return seq.query(query, options)
  }

  // ---------------------------------------------------------------------------

  async getPlaylistInfohash (playlistId: number) {
    const query = 'SELECT "p2pMediaLoaderInfohashes" FROM "videoStreamingPlaylist" WHERE id = :playlistId'

    const result = await this.selectQuery<{ p2pMediaLoaderInfohashes: string }>(query, { playlistId })
    if (!result || result.length === 0) return []

    return result[0].p2pMediaLoaderInfohashes
  }

  // ---------------------------------------------------------------------------

  setActorFollowScores (newScore: number) {
    return this.updateQuery(`UPDATE "actorFollow" SET "score" = :newScore`, { newScore })
  }

  setTokenField (accessToken: string, field: string, value: string) {
    return this.updateQuery(
      `UPDATE "oAuthToken" SET ${this.escapeColumnName(field)} = :value WHERE "accessToken" = :accessToken`,
      { value, accessToken }
    )
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
    const host = '127.0.0.1'
    const port = 5432

    this.sequelize = new Sequelize(dbname, username, password, {
      dialect: 'postgres',
      host,
      port,
      logging: false
    })

    return this.sequelize
  }

  private escapeColumnName (columnName: string) {
    return this.getSequelize().escape(columnName)
      .replace(/^'/, '"')
      .replace(/'$/, '"')
  }
}
