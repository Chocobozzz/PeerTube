import { forceNumber } from '@peertube/peertube-core-utils'
import { AggregateOptions, Attributes, Model, ModelStatic, Op, Sequelize, Transaction, WhereOptions } from 'sequelize'

export async function getNextPositionOf<T extends Model> (options: {
  model: ModelStatic<T>
  columnName: keyof Attributes<T>
  where: WhereOptions<Attributes<T>>
  transaction: Transaction
}) {
  const { columnName, model, where, transaction } = options

  const query: AggregateOptions<number> = {
    where,
    transaction
  }

  const position = await model.max(columnName, query)

  return position
    ? position + 1
    : 1
}

export function reassignPositionOf<T extends Model> (options: {
  model: ModelStatic<T>
  columnName: keyof Attributes<T>
  where: WhereOptions<Attributes<T>>
  transaction: Transaction

  firstPosition: number
  endPosition: number
  newPosition: number
}) {
  const { firstPosition, endPosition, newPosition, model, where, columnName, transaction } = options

  const query = {
    where: {
      ...where,

      [columnName]: {
        [Op.gte]: firstPosition,
        [Op.lte]: endPosition
      }
    },
    transaction,
    validate: false // We use a literal to update the position
  }

  const escapedColumnName = model.sequelize.escape(columnName as string).replace(/'/g, '')
  const positionQuery = Sequelize.literal(`${forceNumber(newPosition)} + "${escapedColumnName}" - ${forceNumber(firstPosition)}`)

  return model.update({ [columnName]: positionQuery } as Record<typeof columnName, typeof positionQuery>, query)
}

export function increasePositionOf<T extends Model> (options: {
  model: ModelStatic<T>
  columnName: keyof Attributes<T>
  where: WhereOptions<Attributes<T>>
  transaction: Transaction

  fromPosition: number
  by: number
}) {
  const { model, where, transaction, fromPosition, by, columnName } = options

  const query = {
    where: {
      ...where,

      [columnName]: {
        [Op.gte]: fromPosition
      }
    },
    transaction
  }

  return model.increment({ [columnName]: by } as Record<typeof columnName, number>, query)
}
