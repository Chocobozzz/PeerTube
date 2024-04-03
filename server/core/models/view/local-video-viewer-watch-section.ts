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
  createdAt: Date

  @AllowNull(false)
  @Column
  watchStart: number

  @AllowNull(false)
  @Column
  watchEnd: number

  @ForeignKey(() => LocalVideoViewerModel)
  @Column
  localVideoViewerId: number

  @BelongsTo(() => LocalVideoViewerModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  LocalVideoViewer: Awaited<LocalVideoViewerModel>

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
