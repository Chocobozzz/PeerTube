import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { Model } from 'sequelize-typescript'

export abstract class SequelizeModel <T> extends Model<Partial<AttributesOnly<T>>> {
  id: number
}
