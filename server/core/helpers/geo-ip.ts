import { CONFIG } from '@server/initializers/config.js'
import { pathExists } from 'fs-extra/esm'
import { writeFile } from 'fs/promises'
import throttle from 'lodash-es/throttle.js'
import maxmind, { CityResponse, CountryResponse, Reader } from 'maxmind'
import { join } from 'path'
import { isArray } from './custom-validators/misc.js'
import { logger, loggerTagsFactory } from './logger.js'
import { isBinaryResponse, peertubeGot } from './requests.js'

const lTags = loggerTagsFactory('geo-ip')

export class GeoIP {
  private static instance: GeoIP

  private countryReader: Reader<CountryResponse>
  private cityReader: Reader<CityResponse>

  private readonly INIT_READERS_RETRY_INTERVAL = 1000 * 60 * 10 // 10 minutes
  private readonly countryDBPath = join(CONFIG.STORAGE.BIN_DIR, 'dbip-country-lite-latest.mmdb')
  private readonly cityDBPath = join(CONFIG.STORAGE.BIN_DIR, 'dbip-city-lite-latest.mmdb')

  private constructor () {
  }

  async safeIPISOLookup (ip: string): Promise<{ country: string, subdivisionName: string }> {
    const emptyResult = { country: null, subdivisionName: null }
    if (CONFIG.GEO_IP.ENABLED === false) return emptyResult

    try {
      await this.initReadersIfNeededThrottle()

      const countryResult = this.countryReader?.get(ip)
      const cityResult = this.cityReader?.get(ip)

      return {
        country: this.getISOCountry(countryResult),
        subdivisionName: this.getISOSubdivision(cityResult)
      }
    } catch (err) {
      logger.error('Cannot get country/city information from IP.', { err })

      return emptyResult
    }
  }

  // ---------------------------------------------------------------------------

  private getISOCountry (countryResult: CountryResponse) {
    return countryResult?.country?.iso_code || null
  }

  private getISOSubdivision (subdivisionResult: CityResponse) {
    const subdivisions = subdivisionResult?.subdivisions
    if (!isArray(subdivisions) || subdivisions.length === 0) return null

    // The last subdivision is the more precise one
    const subdivision = subdivisions[subdivisions.length - 1]

    return subdivision.names?.en || null
  }

  // ---------------------------------------------------------------------------

  async updateDatabases () {
    if (CONFIG.GEO_IP.ENABLED === false) return

    await this.updateCountryDatabase()
    await this.updateCityDatabase()
  }

  private async updateCountryDatabase () {
    if (!CONFIG.GEO_IP.COUNTRY.DATABASE_URL) return false

    await this.updateDatabaseFile(CONFIG.GEO_IP.COUNTRY.DATABASE_URL, this.countryDBPath)

    this.countryReader = undefined

    return true
  }

  private async updateCityDatabase () {
    if (!CONFIG.GEO_IP.CITY.DATABASE_URL) return false

    await this.updateDatabaseFile(CONFIG.GEO_IP.CITY.DATABASE_URL, this.cityDBPath)

    this.cityReader = undefined

    return true
  }

  private async updateDatabaseFile (url: string, destination: string) {
    logger.info('Updating GeoIP databases from %s.', url, lTags())

    const gotOptions = { context: { bodyKBLimit: 800_000 }, responseType: 'buffer' as 'buffer' }

    try {
      const gotResult = await peertubeGot(url, gotOptions)

      if (!isBinaryResponse(gotResult)) {
        throw new Error('Not a binary response')
      }

      await writeFile(destination, gotResult.body)

      logger.info('GeoIP database updated %s.', destination, lTags())
    } catch (err) {
      logger.error('Cannot update GeoIP database from %s.', url, { err, ...lTags() })
    }
  }

  // ---------------------------------------------------------------------------

  private async initReadersIfNeeded () {
    if (!this.countryReader) {
      let open = true

      if (!await pathExists(this.countryDBPath)) {
        open = await this.updateCountryDatabase()
      }

      if (open) {
        this.countryReader = await maxmind.open(this.countryDBPath)
      }
    }

    if (!this.cityReader) {
      let open = true

      if (!await pathExists(this.cityDBPath)) {
        open = await this.updateCityDatabase()
      }

      if (open) {
        this.cityReader = await maxmind.open(this.cityDBPath)
      }
    }
  }

  private readonly initReadersIfNeededThrottle = throttle(this.initReadersIfNeeded.bind(this), this.INIT_READERS_RETRY_INTERVAL)

  // ---------------------------------------------------------------------------

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
