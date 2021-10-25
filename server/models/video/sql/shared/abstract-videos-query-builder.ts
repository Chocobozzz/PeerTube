import { QueryTypes, Sequelize, Transaction } from 'sequelize'

/**
 *
 * Abstact builder to run video SQL queries
 *
 */

export class AbstractVideosQueryBuilder {
  protected sequelize: Sequelize

  protected query: string
  protected replacements: any = {}

  protected runQuery (options: { transaction?: Transaction, logging?: boolean } = {}) {
    const queryOptions = {
      transaction: options.transaction,
      logging: options.logging,
      replacements: this.replacements,
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      nest: false
    }

    return this.sequelize.query<any>(this.query, queryOptions)
  }
}
