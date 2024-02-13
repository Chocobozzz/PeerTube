import { LikesExportJSON } from '@peertube/peertube-models'
import { AbstractRatesImporter, SanitizedRateObject } from './abstract-rates-importer.js'

export class LikesImporter extends AbstractRatesImporter <LikesExportJSON, LikesExportJSON['likes'][0]> {

  protected getImportObjects (json: LikesExportJSON) {
    return json.likes
  }

  protected sanitize (o: LikesExportJSON['likes'][0]) {
    return this.sanitizeRate(o)
  }

  protected async importObject (likesImportData: SanitizedRateObject) {
    return this.importRate(likesImportData, 'like')
  }
}
