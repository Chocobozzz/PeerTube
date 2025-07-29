import { Runner } from '@peertube/peertube-models'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import { MRunner } from '@server/types/models/runners/index.js'
import { FindOptions } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { SequelizeModel, getSort } from '../shared/index.js'
import { RunnerRegistrationTokenModel } from './runner-registration-token.js'

@Table({
  tableName: 'runner',
  indexes: [
    {
      fields: [ 'runnerToken' ],
      unique: true
    },
    {
      fields: [ 'runnerRegistrationTokenId' ]
    },
    {
      fields: [ 'name' ],
      unique: true
    }
  ]
})
export class RunnerModel extends SequelizeModel<RunnerModel> {
  // Used to identify the appropriate runner when it uses the runner REST API
  @AllowNull(false)
  @Column
  declare runnerToken: string

  @AllowNull(false)
  @Column
  declare name: string

  @AllowNull(true)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.RUNNERS.DESCRIPTION.max))
  declare description: string

  @AllowNull(false)
  @Column
  declare lastContact: Date

  @AllowNull(false)
  @Column
  declare ip: string

  @AllowNull(true)
  @Column
  declare version: string

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => RunnerRegistrationTokenModel)
  @Column
  declare runnerRegistrationTokenId: number

  @BelongsTo(() => RunnerRegistrationTokenModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare RunnerRegistrationToken: Awaited<RunnerRegistrationTokenModel>

  // ---------------------------------------------------------------------------

  static load (id: number) {
    return RunnerModel.findByPk(id)
  }

  static loadByToken (runnerToken: string) {
    const query = {
      where: { runnerToken }
    }

    return RunnerModel.findOne(query)
  }

  static loadByName (name: string) {
    const query = {
      where: { name }
    }

    return RunnerModel.findOne(query)
  }

  static listForApi (options: {
    start: number
    count: number
    sort: string
  }) {
    const { start, count, sort } = options

    const query: FindOptions = {
      offset: start,
      limit: count,
      order: getSort(sort)
    }

    return Promise.all([
      RunnerModel.count(query),
      RunnerModel.findAll<MRunner>(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (this: MRunner): Runner {
    return {
      id: this.id,

      name: this.name,
      description: this.description,

      ip: this.ip,
      lastContact: this.lastContact,
      version: this.version,

      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
