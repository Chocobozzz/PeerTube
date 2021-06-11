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

  protected runQuery (transaction?: Transaction) {
    logger.debug('Running videos query.', { query: this.query, replacements: this.replacements })

    const options = {
      transaction,
      replacements: this.replacements,
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      next: false
    }

    return this.sequelize.query<any>(this.query, options)
  }
}
