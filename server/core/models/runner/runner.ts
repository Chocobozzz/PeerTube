import { FindOptions } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { MRunner } from '@server/types/models/runners/index.js'
import { Runner } from '@peertube/peertube-models'
import { SequelizeModel, getSort } from '../shared/index.js'
import { RunnerRegistrationTokenModel } from './runner-registration-token.js'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'

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
  runnerToken: string

  @AllowNull(false)
  @Column
  name: string

  @AllowNull(true)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.RUNNERS.DESCRIPTION.max))
  description: string

  @AllowNull(false)
  @Column
  lastContact: Date

  @AllowNull(false)
  @Column
  ip: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => RunnerRegistrationTokenModel)
  @Column
  runnerRegistrationTokenId: number

  @BelongsTo(() => RunnerRegistrationTokenModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  RunnerRegistrationToken: Awaited<RunnerRegistrationTokenModel>

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

      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
