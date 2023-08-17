import { pathExists } from 'fs-extra/esm'
import { writeFile } from 'fs/promises'
import maxmind, { CountryResponse, Reader } from 'maxmind'
import { join } from 'path'
import { CONFIG } from '@server/initializers/config.js'
import { logger, loggerTagsFactory } from './logger.js'
import { isBinaryResponse, peertubeGot } from './requests.js'

const lTags = loggerTagsFactory('geo-ip')

const mmbdFilename = 'dbip-country-lite-latest.mmdb'
const mmdbPath = join(CONFIG.STORAGE.BIN_DIR, mmbdFilename)

export class GeoIP {
  private static instance: GeoIP

  private reader: Reader<CountryResponse>

  private constructor () {
  }

  async safeCountryISOLookup (ip: string): Promise<string> {
    if (CONFIG.GEO_IP.ENABLED === false) return null

    await this.initReaderIfNeeded()

    try {
      const result = this.reader.get(ip)
      if (!result) return null

      return result.country.iso_code
    } catch (err) {
      logger.error('Cannot get country from IP.', { err })

      return null
    }
  }

  async updateDatabase () {
    if (CONFIG.GEO_IP.ENABLED === false) return

    const url = CONFIG.GEO_IP.COUNTRY.DATABASE_URL

    logger.info('Updating GeoIP database from %s.', url, lTags())

    const gotOptions = { context: { bodyKBLimit: 200_000 }, responseType: 'buffer' as 'buffer' }

    try {
      const gotResult = await peertubeGot(url, gotOptions)

      if (!isBinaryResponse(gotResult)) {
        throw new Error('Not a binary response')
      }

      await writeFile(mmdbPath, gotResult.body)

      // Reinit reader
      this.reader = undefined

      logger.info('GeoIP database updated %s.', mmdbPath, lTags())
    } catch (err) {
      logger.error('Cannot update GeoIP database from %s.', url, { err, ...lTags() })
    }
  }

  private async initReaderIfNeeded () {
    if (!this.reader) {
      if (!await pathExists(mmdbPath)) {
        await this.updateDatabase()
      }

      this.reader = await maxmind.open(mmdbPath)
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
