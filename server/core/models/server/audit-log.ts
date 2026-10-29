import { AuditLog, type AuditLogActionType, type AuditLogChange, type AuditLogEntityTypeType } from '@peertube/peertube-models'
import { MAX_SQL_DELETE_ITEMS } from '@server/initializers/constants.js'
import { MAuditLog } from '@server/types/models/index.js'
import { FindOptions, Op, WhereOptions } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table } from 'sequelize-typescript'
import { getSort, safeBulkDestroy, SequelizeModel } from '../shared/index.js'
import { UserModel } from '../user/user.js'

@Table({
  tableName: 'auditLog',
  updatedAt: false,
  indexes: [
    {
      fields: [ 'createdAt' ]
    },
    {
      fields: [ 'entityType', 'entityId' ]
    },
    {
      fields: [ 'userId' ]
    }
  ]
})
export class AuditLogModel extends SequelizeModel<AuditLogModel> {
  @CreatedAt
  declare createdAt: Date

  @AllowNull(false)
  @Column
  declare action: AuditLogActionType

  @AllowNull(false)
  @Column
  declare entityType: AuditLogEntityTypeType

  @AllowNull(true)
  @Column
  declare entityId: number

  @ForeignKey(() => UserModel)
  @Column
  declare userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  declare User: Awaited<UserModel>

  @AllowNull(false)
  @Column
  declare username: string

  @AllowNull(true)
  @Column
  declare ip: string

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare entity: Record<string, any>

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare changes: Record<string, AuditLogChange>

  // ---------------------------------------------------------------------------

  static async listForApi (options: {
    start: number
    count: number
    sort: string
    withTotal: boolean

    search?: string
    entityType?: AuditLogEntityTypeType
    entityId?: number
    action?: AuditLogActionType
    startDate?: Date
    endDate?: Date
  }) {
    const { start, count, sort, withTotal, search, entityType, entityId, action, startDate, endDate } = options

    const where: WhereOptions = {}

    if (entityType) Object.assign(where, { entityType })
    if (entityId) Object.assign(where, { entityId })
    if (action) Object.assign(where, { action })

    if (startDate || endDate) {
      Object.assign(where, {
        createdAt: {
          ...(startDate ? { [Op.gte]: startDate } : {}),
          ...(endDate ? { [Op.lte]: endDate } : {})
        }
      })
    }

    if (search) {
      const iLike = '%' + search + '%'

      Object.assign(where, {
        [Op.or]: [
          { username: { [Op.iLike]: iLike } },
          { ip: { [Op.iLike]: iLike } },
          AuditLogModel.sequelize.where(AuditLogModel.sequelize.cast(AuditLogModel.sequelize.col('entity'), 'text'), Op.iLike, iLike)
        ]
      })
    }

    const query: FindOptions = {
      where,
      offset: start,
      limit: count,
      // Keep entries created in the same millisecond in insertion order
      order: getSort(sort, [ 'id', sort.startsWith('-') ? 'DESC' : 'ASC' ])
    }

    const [ total, data ] = await Promise.all([
      withTotal
        ? AuditLogModel.count(query)
        : Promise.resolve(undefined as number),

      AuditLogModel.findAll<MAuditLog>(query)
    ])

    return { total, data }
  }

  static removeOldLogs (beforeDate: string) {
    return safeBulkDestroy(() => {
      return AuditLogModel.destroy({
        where: {
          createdAt: {
            [Op.lt]: beforeDate
          }
        },
        limit: MAX_SQL_DELETE_ITEMS
      })
    })
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (this: MAuditLog): AuditLog {
    const createdAt = this.createdAt.toISOString()

    return {
      id: this.id,
      action: this.action,
      entityType: this.entityType,
      entityId: this.entityId,
      user: {
        id: this.userId,
        username: this.username
      },
      ip: this.ip,
      entity: this.entity,
      changes: this.changes,
      createdAt,

      // Deprecated fields of the log file format
      timestamp: createdAt,
      level: 'audit',
      message: JSON.stringify({
        user: this.username,
        domain: this.entityType,
        action: this.action,
        entityId: this.entityId,
        ip: this.ip,
        ...this.entity,
        changes: this.changes
      })
    }
  }
}
