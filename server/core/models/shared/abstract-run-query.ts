import { QueryTypes, Sequelize, Transaction } from 'sequelize'

/**
 *
 * Abstract builder to run video SQL queries
 *
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

  protected buildSelect (entities: string[]) {
    return `SELECT ${entities.join(', ')} `
  }
}
