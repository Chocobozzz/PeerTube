import { BindOrReplacements, QueryTypes } from 'sequelize'
import { sequelizeTypescript } from '@server/initializers/database'

function doesExist (query: string, bind?: BindOrReplacements) {
  const options = {
    type: QueryTypes.SELECT as QueryTypes.SELECT,
    bind,
    raw: true
  }

  return sequelizeTypescript.query(query, options)
            .then(results => results.length === 1)
}

export {
  doesExist
}
