import { MEmbedPrivacyDomain } from '@server/types/models/video/video-embed-privacy-domain.js'
import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { doesExist, getSort, SequelizeModel } from '../shared/index.js'
import { VideoModel } from './video.js'

@Table({
  tableName: 'videoEmbedPrivacyDomain',
  indexes: [
    {
      fields: [ 'domain', 'videoId' ],
      unique: true
    }
  ]
})
export class VideoEmbedPrivacyDomainModel extends SequelizeModel<VideoEmbedPrivacyDomainModel> {
  @AllowNull(false)
  @Column
  declare domain: string

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare Video: Awaited<VideoModel>

  static list (videoId: number) {
    return this.findAll({
      where: {
        videoId
      },
      limit: 1000,
      order: getSort('createdAt')
    })
  }

  static isDomainAllowed (videoId: number, domain: string) {
    const sanitizedDomain = this.sanitizeDomain(domain)

    const query = 'SELECT 1 FROM "videoEmbedPrivacyDomain" ' +
      `WHERE "videoId" = $videoId AND "domain" = $domain LIMIT 1`

    return doesExist({ sequelize: this.sequelize, query, bind: { videoId, domain: sanitizedDomain } })
  }

  static async addDomains (domains: string[], videoId: number, transaction?: Transaction): Promise<void> {
    for (const domain of domains) {
      await this.addDomain(domain, videoId, transaction)
    }
  }

  static async addDomain (domain: string, videoId: number, transaction?: Transaction): Promise<MEmbedPrivacyDomain> {
    const sanitizedDomain = this.sanitizeDomain(domain)

    return this.create({ domain: sanitizedDomain, videoId }, { transaction })
  }

  static async deleteAllDomains (videoId: number, transaction?: Transaction) {
    await this.destroy({
      where: { videoId },
      transaction
    })
  }

  private static sanitizeDomain (domain: string) {
    return domain.trim().toLowerCase()
  }
}
