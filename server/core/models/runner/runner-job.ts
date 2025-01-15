import {
  RunnerJob,
  RunnerJobAdmin,
  RunnerJobState,
  type RunnerJobPayload,
  type RunnerJobPrivatePayload,
  type RunnerJobStateType,
  type RunnerJobType
} from '@peertube/peertube-models'
import { isArray, isUUIDValid } from '@server/helpers/custom-validators/misc.js'
import { CONSTRAINTS_FIELDS, RUNNER_JOB_STATES } from '@server/initializers/constants.js'
import { MRunnerJob, MRunnerJobRunner, MRunnerJobRunnerParent } from '@server/types/models/runners/index.js'
import { Op, Transaction } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsUUID, Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { SequelizeModel, getSort, searchAttribute } from '../shared/index.js'
import { RunnerModel } from './runner.js'

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
export class RunnerJobModel extends SequelizeModel<RunnerJobModel> {

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
  state: RunnerJobStateType

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
  DependsOnRunnerJob: Awaited<RunnerJobModel>

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
  Runner: Awaited<RunnerModel>

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

  static listAvailableJobs (jobTypes?: string[]) {
    const jobTypesWhere = jobTypes
      ? {
        type: {
          [Op.in]: jobTypes
        }
      }
      : {}

    return RunnerJobModel.findAll<MRunnerJob>({
      limit: 10,
      order: getSort('priority'),
      where: {
        state: RunnerJobState.PENDING,

        ...jobTypesWhere
      }
    })
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
    stateOneOf?: RunnerJobStateType[]
  }) {
    const { start, count, sort, search, stateOneOf } = options

    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: []
    }

    if (search) {
      if (isUUIDValid(search)) {
        query.where.push({ uuid: search })
      } else {
        query.where.push({
          [Op.or]: [
            searchAttribute(search, 'type'),
            searchAttribute(search, '$Runner.name$')
          ]
        })
      }
    }

    if (isArray(stateOneOf) && stateOneOf.length !== 0) {
      query.where.push({
        state: {
          [Op.in]: stateOneOf
        }
      })
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

  static cancelAllNonFinishedJobs (options: { type: RunnerJobType }) {
    const where = {
      type: options.type,
      state: {
        [Op.in]: [ RunnerJobState.COMPLETING, RunnerJobState.PENDING, RunnerJobState.PROCESSING, RunnerJobState.WAITING_FOR_PARENT_JOB ]
      }
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
    // eslint-disable-next-line max-len
    state: typeof RunnerJobState.PARENT_ERRORED | typeof RunnerJobState.ERRORED | typeof RunnerJobState.CANCELLED | typeof RunnerJobState.PARENT_CANCELLED
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
