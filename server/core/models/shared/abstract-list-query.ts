import { AbstractRunQuery, ModelBuilder, parseRowCountResult } from '@server/models/shared/index.js'
import { Model, Sequelize, Transaction } from 'sequelize'

export interface AbstractListQueryOptions {
  start?: number
  count?: number
  sort?: string
  transaction?: Transaction
}

export interface ModelInfo {
  tableName: string
  modelName: string
}

export abstract class AbstractListQuery extends AbstractRunQuery {
  protected attributes: string[] = []
  protected join = ''

  private subQuery: string

  protected subQueryAttributes: string[] = []
  protected subQueryLateralJoin = ''
  protected subQueryJoin = ''
  protected subQueryWhere = ''

  protected abstract buildQueryAttributes (): void
  protected abstract buildQueryJoin (): void

  protected abstract buildSubQueryWhere (): void
  protected abstract buildSubQueryAttributes (): void
  protected abstract buildSubQueryJoin (): void

  protected buildSubQueryLateralJoin () {
    // Optional
  }

  protected getCalculatedAttributes () {
    return []
  }

  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly modelInfo: ModelInfo,
    protected readonly options: AbstractListQueryOptions
  ) {
    super(sequelize)
  }

  async get<T extends Model> () {
    this.options.start = 0
    this.options.count = 1

    const rows = await this.list<T>()

    return rows.length === 1
      ? rows[0]
      : null
  }

  async list<T extends Model> () {
    this.buildListQuery()

    const results = await this.runQuery({ nest: true, transaction: this.options.transaction })
    const modelBuilder = new ModelBuilder<T>(this.sequelize)

    return modelBuilder.createModels(results, this.modelInfo.modelName.replace(/Model$/, ''))
  }

  async count () {
    this.buildCountQuery()

    const result = await this.runQuery({ transaction: this.options.transaction })

    return parseRowCountResult(result)
  }

  // ---------------------------------------------------------------------------

  private buildListQuery () {
    this.buildSubQuery()

    this.attributes = [ `"${this.modelInfo.modelName}".*` ]
    this.buildQueryAttributes()
    this.buildQueryJoin()

    this.query = `${this.buildSelect(this.attributes)} ` +
      `FROM (${this.subQuery}) AS "${this.modelInfo.modelName}" ` +
      `${this.join} ` +
      `${this.getOrder(this.modelInfo.modelName, this.options.sort)}`
  }

  private buildSubQuery () {
    this.buildSubQueryWhere()
    this.buildSubQueryJoin()
    this.buildSubQueryLateralJoin()
    this.buildSubQueryAttributes()

    this.subQuery = `${this.buildSelect(this.subQueryAttributes)} ` +
      `FROM "${this.modelInfo.tableName}" AS "${this.modelInfo.modelName}" ` +
      `${this.subQueryJoin} ` +
      `${this.subQueryLateralJoin} ` +
      `${this.subQueryWhere} `

    if (this.options.sort) {
      this.subQuery += `${this.getOrder(this.modelInfo.modelName, this.options.sort, this.getCalculatedAttributes())} `
    }

    if (this.options.start !== undefined && this.options.count !== undefined) {
      this.subQuery += this.getLimit(this.options.start, this.options.count)
    }
  }

  // ---------------------------------------------------------------------------

  private buildCountQuery () {
    this.buildSubQueryWhere()

    this.query = `SELECT COUNT(*) AS "total" ` +
      `FROM "${this.modelInfo.tableName}" AS "${this.modelInfo.modelName}" ` +
      `${this.subQueryJoin} ` +
      `${this.subQueryWhere}`
  }
}
