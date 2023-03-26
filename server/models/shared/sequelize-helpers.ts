import { Sequelize } from 'sequelize'

function isOutdated (model: { createdAt: Date, updatedAt: Date }, refreshInterval: number) {
  if (!model.createdAt || !model.updatedAt) {
    throw new Error('Miss createdAt & updatedAt attributes to model')
  }

  const now = Date.now()
  const createdAtTime = model.createdAt.getTime()
  const updatedAtTime = model.updatedAt.getTime()

  return (now - createdAtTime) > refreshInterval && (now - updatedAtTime) > refreshInterval
}

function throwIfNotValid (value: any, validator: (value: any) => boolean, fieldName = 'value', nullable = false) {
  if (nullable && (value === null || value === undefined)) return

  if (validator(value) === false) {
    throw new Error(`"${value}" is not a valid ${fieldName}.`)
  }
}

function buildTrigramSearchIndex (indexName: string, attribute: string) {
  return {
    name: indexName,
    // FIXME: gin_trgm_ops is not taken into account in Sequelize 6, so adding it ourselves in the literal function
    fields: [ Sequelize.literal('lower(immutable_unaccent(' + attribute + ')) gin_trgm_ops') as any ],
    using: 'gin',
    operator: 'gin_trgm_ops'
  }
}

// ---------------------------------------------------------------------------

export {
  throwIfNotValid,
  buildTrigramSearchIndex,
  isOutdated
}
