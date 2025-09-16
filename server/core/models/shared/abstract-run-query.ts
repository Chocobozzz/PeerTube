import { QueryTypes, Sequelize, Transaction } from 'sequelize'
import { getSort } from './sort.js'
import { Col } from 'sequelize/lib/utils'

/**
 * Abstract builder to run video SQL queries
 */

export class AbstractRunQuery {
  protected query: string
  protected replacements: any = {}

  protected queryConfig = ''

  constructor (protected readonly sequelize: Sequelize) {
  }

  protected async runQuery (options: { nest?: boolean, transaction?: Transaction, logging?: boolean } = {}) {
    const queryOptions = {
      transaction: options.transaction,
      logging: options.logging,
      replacements: this.replacements,
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      nest: options.nest ?? false
    }

    if (this.queryConfig) {
      await this.sequelize.query(this.queryConfig, queryOptions)
    }

    return this.sequelize.query<any>(this.query, queryOptions)
  }

  protected buildSelect (attributes: string[]) {
    return `SELECT ${attributes.join(', ')} `
  }

  // ---------------------------------------------------------------------------

  protected getOrder (tableName: string, sort: string, calculatedAttributes: string[] = []) {
    if (!sort) return ''

    const orders = this.getSort(sort)

    const orderStr = orders.map(o => {
      const columnName = o[0] instanceof Col
        ? o[0].col
        : o[0]

      const direction = o[1]

      // Prefix with the table name if the column name isn't a full path
      // ("id", "displayName", etc. VS "ActorModel.id", "Server.redundancyAllowed", etc.)
      const prefix = calculatedAttributes.includes(columnName) || columnName.includes('.')
        ? ''
        : `"${tableName}".`

      return `${prefix}"${columnName}" ${direction}`
    }).join(', ')

    return 'ORDER BY ' + orderStr
  }

  protected getSort (sort: string) {
    return getSort(sort)
  }

  // ---------------------------------------------------------------------------

  protected getLimit (start: number, count: number) {
    if (!count) return ''

    this.replacements.limit = count
    this.replacements.offset = start || 0

    return `LIMIT :limit OFFSET :offset `
  }
}
