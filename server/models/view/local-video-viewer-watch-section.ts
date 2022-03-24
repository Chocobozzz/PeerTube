import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Model, Table } from 'sequelize-typescript'
import { MLocalVideoViewerWatchSection } from '@server/types/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { LocalVideoViewerModel } from './local-video-viewer'

@Table({
  tableName: 'localVideoViewerWatchSection',
  updatedAt: false,
  indexes: [
    {
      fields: [ 'localVideoViewerId' ]
    }
  ]
})
export class LocalVideoViewerWatchSectionModel extends Model<Partial<AttributesOnly<LocalVideoViewerWatchSectionModel>>> {
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
  LocalVideoViewer: LocalVideoViewerModel

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
      const model = await this.create({
        watchStart: section.start,
        watchEnd: section.end,
        localVideoViewerId
      }, { transaction })

      models.push(model)
    }

    return models
  }
}
