import { DislikesExportJSON } from '@peertube/peertube-models'
import { AbstractRatesImporter, SanitizedRateObject } from './abstract-rates-importer.js'

export class DislikesImporter extends AbstractRatesImporter <DislikesExportJSON, DislikesExportJSON['dislikes'][0]> {

  protected getImportObjects (json: DislikesExportJSON) {
    return json.dislikes
  }

  protected sanitize (o: DislikesExportJSON['dislikes'][0]) {
    return this.sanitizeRate(o)
  }

  protected async importObject (dislikesImportData: SanitizedRateObject) {
    return this.importRate(dislikesImportData, 'dislike')
  }
}
