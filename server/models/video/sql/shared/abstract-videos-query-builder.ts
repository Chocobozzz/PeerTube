import { QueryTypes, Sequelize, Transaction } from 'sequelize'
import { logger } from '@server/helpers/logger'

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
    logger.debug('Running videos query.', { query: this.query, replacements: this.replacements })

    const queryOptions = {
      transaction: options.transaction,
      logging: options.logging,
      replacements: this.replacements,
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      next: false
    }

    return this.sequelize.query<any>(this.query, queryOptions)
  }
}
