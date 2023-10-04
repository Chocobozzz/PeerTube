import { QueryTypes, Sequelize, Transaction } from 'sequelize'

/**
 *
 * Abstract builder to run video SQL queries
 *
 */

export class AbstractRunQuery {
  protected query: string
  protected replacements: any = {}

  constructor (protected readonly sequelize: Sequelize) {

  }

  protected runQuery (options: { nest?: boolean, transaction?: Transaction, logging?: boolean } = {}) {
    const queryOptions = {
      transaction: options.transaction,
      logging: options.logging,
      replacements: this.replacements,
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      nest: options.nest ?? false
    }

    return this.sequelize.query<any>(this.query, queryOptions)
  }

  protected buildSelect (entities: string[]) {
    return `SELECT ${entities.join(', ')} `
  }
}
