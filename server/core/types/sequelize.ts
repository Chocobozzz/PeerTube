import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { Model } from 'sequelize'

// Thanks to sequelize-typescript: https://github.com/RobinBuschmann/sequelize-typescript

export type Diff<T extends string | symbol | number, U extends string | symbol | number> =
  ({ [P in T]: P } & { [P in U]: never } & { [x: string]: never })[T]

export type Omit<T, K extends keyof T> = { [P in Diff<keyof T, K>]: T[P] }

export type RecursivePartial<T> = { [P in keyof T]?: RecursivePartial<T[P]> }

export type FilteredModelAttributes<T extends Model> = Partial<AttributesOnly<T>> & {
  id?: number
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date
  version?: number
}
