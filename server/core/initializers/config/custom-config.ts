import { CustomConfig } from '@peertube/peertube-models'
import snakeCase from 'lodash-es/snakeCase.js'
import validator from 'validator'
import { objectConverter } from '@peertube/peertube-node-utils'

/**
 * Convert the body of `PUT /api/v1/config/custom` into the shape of the configuration file: camelCase to
 * snake_case keys, and numbers stored as numbers.
 *
 * Kept out of the controller so it can be used without loading the whole Express and Sequelize tree.
 */
export function convertCustomConfigBody (body: CustomConfig) {
  function keyConverter (k: string) {
    // Transcoding resolutions exception
    if (/^\d{3,4}p$/.exec(k)) return k
    if (k === '0p') return k
    if (k === 'p2p') return k

    return snakeCase(k)
  }

  function valueConverter (v: any) {
    if (validator.isNumeric(v + '')) return parseInt('' + v, 10)

    return v
  }

  return objectConverter(body, keyConverter, valueConverter)
}
