import { MLocalVideoViewerWatchSection } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Table } from 'sequelize-typescript'
import { SequelizeModel } from '../shared/index.js'
import { LocalVideoViewerModel } from './local-video-viewer.js'

@Table({
  tableName: 'localVideoViewerWatchSection',
  updatedAt: false,
  indexes: [
    {
      fields: [ 'localVideoViewerId' ]
    }
  ]
})
export class LocalVideoViewerWatchSectionModel extends SequelizeModel<LocalVideoViewerWatchSectionModel> {
  @CreatedAt
  declare createdAt: Date

  @AllowNull(false)
  @Column
  declare watchStart: number

  @AllowNull(false)
  @Column
  declare watchEnd: number

  @ForeignKey(() => LocalVideoViewerModel)
  @Column
  declare localVideoViewerId: number

  @BelongsTo(() => LocalVideoViewerModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare LocalVideoViewer: Awaited<LocalVideoViewerModel>

  static async bulkCreateSections (options: {
    localVideoViewerId: number
    watchSections: {
      start: number
      end: number
    }[]
    transaction?: Transaction
  }) {
    const { localVideoViewerId, watchSections, transaction } = options
    const models: MLocalVideoViewerWatchSection[] = []

    for (const section of watchSections) {
      const watchStart = section.start || 0
      const watchEnd = section.end || 0

      if (watchStart === watchEnd) continue

      const model = await this.create({
        watchStart,
        watchEnd,
        localVideoViewerId
      }, { transaction })

      models.push(model)
    }

    return models
  }
}
