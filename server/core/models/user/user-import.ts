import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { MUserImport } from '@server/types/models/index.js'
import { SequelizeModel } from '../shared/index.js'
import { UserModel } from './user.js'
import type { UserImportResultSummary, UserImportStateType } from '@peertube/peertube-models'
import { getSort } from '../shared/sort.js'
import { USER_IMPORT_STATES } from '@server/initializers/constants.js'

@Table({
  tableName: 'userImport',
  indexes: [
    {
      fields: [ 'userId' ]
    },
    {
      fields: [ 'filename' ],
      unique: true
    }
  ]
})
export class UserImportModel extends SequelizeModel<UserImportModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(true)
  @Column
  declare filename: string

  @AllowNull(false)
  @Column
  declare state: UserImportStateType

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare error: string

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare resultSummary: UserImportResultSummary

  @ForeignKey(() => UserModel)
  @Column
  declare userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare User: Awaited<UserModel>

  static load (id: number | string) {
    return UserImportModel.findByPk<MUserImport>(id)
  }

  static loadLatestByUserId (userId: number) {
    return UserImportModel.findOne<MUserImport>({
      where: {
        userId
      },
      order: getSort('-createdAt')
    })
  }

  // ---------------------------------------------------------------------------

  generateAndSetFilename () {
    if (!this.userId) throw new Error('Cannot generate filename without userId')
    if (!this.createdAt) throw new Error('Cannot generate filename without createdAt')

    this.filename = `user-import-${this.userId}-${this.createdAt.toISOString()}.zip`
  }

  toFormattedJSON () {
    return {
      id: this.id,
      state: {
        id: this.state,
        label: USER_IMPORT_STATES[this.state]
      },
      createdAt: this.createdAt.toISOString()
    }
  }
}
