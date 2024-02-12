import { DislikesExportJSON } from '@peertube/peertube-models'
import { AbstractRatesImporter } from './abstract-rates-importer.js'

export class DislikesImporter extends AbstractRatesImporter <DislikesExportJSON, DislikesExportJSON['dislikes'][0]> {

  protected getImportObjects (json: DislikesExportJSON) {
    return json.dislikes
  }

  protected sanitize (o: DislikesExportJSON['dislikes'][0]) {
    return this.sanitizeRate(o)
  }

  protected async importObject (dislikesImportData: DislikesExportJSON['dislikes'][0]) {
    return this.importRate(dislikesImportData, 'dislike')
  }
}
