import type { UserImportResultSummary, UserImportStateType } from '@peertube/peertube-models'
import { USER_IMPORT_FILE_PREFIX, USER_IMPORT_STATES } from '@server/initializers/constants.js'
import { MUserImport } from '@server/types/models/index.js'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { doesExist, SequelizeModel } from '../shared/index.js'
import { getSort } from '../shared/sort.js'
import { UserModel } from './user.js'

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

  static async doesOwnedFileExist (filename: string) {
    const query = 'SELECT 1 FROM "userImport" ' +
      `WHERE "filename" = $filename LIMIT 1`

    return doesExist({ sequelize: this.sequelize, query, bind: { filename } })
  }

  // ---------------------------------------------------------------------------

  generateAndSetFilename () {
    if (!this.userId) throw new Error('Cannot generate filename without userId')
    if (!this.createdAt) throw new Error('Cannot generate filename without createdAt')

    this.filename = `${USER_IMPORT_FILE_PREFIX}${this.userId}-${this.createdAt.toISOString()}.zip`
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
