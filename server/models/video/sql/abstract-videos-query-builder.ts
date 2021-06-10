import { logger } from '@server/helpers/logger'
import { Sequelize, QueryTypes } from 'sequelize'

export class AbstractVideosQueryBuilder {
  protected sequelize: Sequelize

  protected query: string
  protected replacements: any = {}

  protected runQuery (nest?: boolean) {
    logger.info('Running video query.', { query: this.query, replacements: this.replacements })

    return this.sequelize.query<any>(this.query, { replacements: this.replacements, type: QueryTypes.SELECT, nest })
  }
}
