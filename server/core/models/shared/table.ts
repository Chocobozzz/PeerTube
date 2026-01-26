import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { Model, ModelStatic } from 'sequelize'

export function buildSQLAttributes<M extends Model> (options: {
  model: ModelStatic<M>
  tableName: string

  excludeAttributes?: readonly Exclude<keyof AttributesOnly<M>, symbol>[]
  includeAttributes?: readonly Exclude<keyof AttributesOnly<M>, symbol>[]

  aliasPrefix?: string

  idBuilder?: string[]
}) {
  const { model, tableName, aliasPrefix = '', excludeAttributes, includeAttributes, idBuilder } = options

  const attributes = Object.keys(model.getAttributes()) as Exclude<keyof AttributesOnly<M>, symbol>[]

  const builtAttributes = attributes
    .filter(a => {
      if (!excludeAttributes) return true
      if (excludeAttributes.includes(a)) return false

      return true
    })
    .filter(a => {
      if (!includeAttributes) return true
      if (includeAttributes.includes(a)) return true

      return false
    })
    .map(a => {
      return `"${tableName}"."${a}" AS "${aliasPrefix}${a}"`
    })

  if (idBuilder) {
    const idSelect = idBuilder.map(a => `"${tableName}"."${a}"`)
      .join(` || '-' || `)

    builtAttributes.push(`${idSelect} AS "${aliasPrefix}id"`)
  }

  return builtAttributes
}
