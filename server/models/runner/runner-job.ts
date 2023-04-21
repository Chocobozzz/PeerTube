import { FindOptions, Op, Transaction } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isUUIDValid } from '@server/helpers/custom-validators/misc'
import { CONSTRAINTS_FIELDS, RUNNER_JOB_STATES } from '@server/initializers/constants'
import { MRunnerJob, MRunnerJobRunner, MRunnerJobRunnerParent } from '@server/types/models/runners'
import { RunnerJob, RunnerJobAdmin, RunnerJobPayload, RunnerJobPrivatePayload, RunnerJobState, RunnerJobType } from '@shared/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { getSort, searchAttribute } from '../shared'
import { RunnerModel } from './runner'

enum ScopeNames {
  WITH_RUNNER = 'WITH_RUNNER',
  WITH_PARENT = 'WITH_PARENT'
}

@Scopes(() => ({
  [ScopeNames.WITH_RUNNER]: {
    include: [
      {
        model: RunnerModel.unscoped(),
        required: false
      }
    ]
  },
  [ScopeNames.WITH_PARENT]: {
    include: [
      {
        model: RunnerJobModel.unscoped(),
        required: false
      }
    ]
  }
}))
@Table({
  tableName: 'runnerJob',
  indexes: [
    {
      fields: [ 'uuid' ],
      unique: true
    },
    {
      fields: [ 'processingJobToken' ],
      unique: true
    },
    {
      fields: [ 'runnerId' ]
    }
  ]
})
export class RunnerJobModel extends Model<Partial<AttributesOnly<RunnerJobModel>>> {

  @AllowNull(false)
  @IsUUID(4)
  @Column(DataType.UUID)
  uuid: string

  @AllowNull(false)
  @Column
  type: RunnerJobType

  @AllowNull(false)
  @Column(DataType.JSONB)
  payload: RunnerJobPayload

  @AllowNull(false)
  @Column(DataType.JSONB)
  privatePayload: RunnerJobPrivatePayload

  @AllowNull(false)
  @Column
  state: RunnerJobState

  @AllowNull(false)
  @Default(0)
  @Column
  failures: number

  @AllowNull(true)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.RUNNER_JOBS.ERROR_MESSAGE.max))
  error: string

  // Less has priority
  @AllowNull(false)
  @Column
  priority: number

  // Used to fetch the appropriate job when the runner wants to post the result
  @AllowNull(true)
  @Column
  processingJobToken: string

  @AllowNull(true)
  @Column
  progress: number

  @AllowNull(true)
  @Column
  startedAt: Date

  @AllowNull(true)
  @Column
  finishedAt: Date

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => RunnerJobModel)
  @Column
  dependsOnRunnerJobId: number

  @BelongsTo(() => RunnerJobModel, {
    foreignKey: {
      name: 'dependsOnRunnerJobId',
      allowNull: true
    },
    onDelete: 'cascade'
  })
  DependsOnRunnerJob: RunnerJobModel

  @ForeignKey(() => RunnerModel)
  @Column
  runnerId: number

  @BelongsTo(() => RunnerModel, {
    foreignKey: {
      name: 'runnerId',
      allowNull: true
    },
    onDelete: 'SET NULL'
  })
  Runner: RunnerModel

  // ---------------------------------------------------------------------------

  static loadWithRunner (uuid: string) {
    const query = {
      where: { uuid }
    }

    return RunnerJobModel.scope(ScopeNames.WITH_RUNNER).findOne<MRunnerJobRunner>(query)
  }

  static loadByRunnerAndJobTokensWithRunner (options: {
    uuid: string
    runnerToken: string
    jobToken: string
  }) {
    const { uuid, runnerToken, jobToken } = options

    const query = {
      where: {
        uuid,
        processingJobToken: jobToken
      },
      include: {
        model: RunnerModel.unscoped(),
        required: true,
        where: {
          runnerToken
        }
      }
    }

    return RunnerJobModel.findOne<MRunnerJobRunner>(query)
  }

  static listAvailableJobs () {
    const query = {
      limit: 10,
      order: getSort('priority'),
      where: {
        state: RunnerJobState.PENDING
      }
    }

    return RunnerJobModel.findAll<MRunnerJob>(query)
  }

  static listStalledJobs (options: {
    staleTimeMS: number
    types: RunnerJobType[]
  }) {
    const before = new Date(Date.now() - options.staleTimeMS)

    return RunnerJobModel.findAll<MRunnerJob>({
      where: {
        type: {
          [Op.in]: options.types
        },
        state: RunnerJobState.PROCESSING,
        updatedAt: {
          [Op.lt]: before
        }
      }
    })
  }

  static listChildrenOf (job: MRunnerJob, transaction?: Transaction) {
    const query = {
      where: {
        dependsOnRunnerJobId: job.id
      },
      transaction
    }

    return RunnerJobModel.findAll<MRunnerJob>(query)
  }

  static listForApi (options: {
    start: number
    count: number
    sort: string
    search?: string
  }) {
    const { start, count, sort, search } = options

    const query: FindOptions = {
      offset: start,
      limit: count,
      order: getSort(sort)
    }

    if (search) {
      if (isUUIDValid(search)) {
        query.where = { uuid: search }
      } else {
        query.where = {
          [Op.or]: [
            searchAttribute(search, 'type'),
            searchAttribute(search, '$Runner.name$')
          ]
        }
      }
    }

    return Promise.all([
      RunnerJobModel.scope([ ScopeNames.WITH_RUNNER ]).count(query),
      RunnerJobModel.scope([ ScopeNames.WITH_RUNNER, ScopeNames.WITH_PARENT ]).findAll<MRunnerJobRunnerParent>(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static updateDependantJobsOf (runnerJob: MRunnerJob) {
    const where = {
      dependsOnRunnerJobId: runnerJob.id
    }

    return RunnerJobModel.update({ state: RunnerJobState.PENDING }, { where })
  }

  static cancelAllJobs (options: { type: RunnerJobType }) {
    const where = {
      type: options.type
    }

    return RunnerJobModel.update({ state: RunnerJobState.CANCELLED }, { where })
  }

  // ---------------------------------------------------------------------------

  resetToPending () {
    this.state = RunnerJobState.PENDING
    this.processingJobToken = null
    this.progress = null
    this.startedAt = null
    this.runnerId = null
  }

  setToErrorOrCancel (
    state: RunnerJobState.PARENT_ERRORED | RunnerJobState.ERRORED | RunnerJobState.CANCELLED | RunnerJobState.PARENT_CANCELLED
  ) {
    this.state = state
    this.processingJobToken = null
    this.finishedAt = new Date()
  }

  toFormattedJSON (this: MRunnerJobRunnerParent): RunnerJob {
    const runner = this.Runner
      ? {
        id: this.Runner.id,
        name: this.Runner.name,
        description: this.Runner.description
      }
      : null

    const parent = this.DependsOnRunnerJob
      ? {
        id: this.DependsOnRunnerJob.id,
        uuid: this.DependsOnRunnerJob.uuid,
        type: this.DependsOnRunnerJob.type,
        state: {
          id: this.DependsOnRunnerJob.state,
          label: RUNNER_JOB_STATES[this.DependsOnRunnerJob.state]
        }
      }
      : undefined

    return {
      uuid: this.uuid,
      type: this.type,

      state: {
        id: this.state,
        label: RUNNER_JOB_STATES[this.state]
      },

      progress: this.progress,
      priority: this.priority,
      failures: this.failures,
      error: this.error,

      payload: this.payload,

      startedAt: this.startedAt?.toISOString(),
      finishedAt: this.finishedAt?.toISOString(),

      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),

      parent,
      runner
    }
  }

  toFormattedAdminJSON (this: MRunnerJobRunnerParent): RunnerJobAdmin {
    return {
      ...this.toFormattedJSON(),

      privatePayload: this.privatePayload
    }
  }
}
