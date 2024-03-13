import { forkJoin } from 'rxjs'
import { catchError, map } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { MarkdownService, RestExtractor, ServerService } from '@app/core'
import { objectKeysTyped, peertubeTranslate } from '@peertube/peertube-core-utils'
import { About } from '@peertube/peertube-models'
import { environment } from '../../../../environments/environment'
import { logger } from '@root-helpers/logger'

export type AboutHTML = Pick<About['instance'],
'terms' | 'codeOfConduct' | 'moderationInformation' | 'administrator' | 'creationReason' |
'maintenanceLifetime' | 'businessModel' | 'hardwareInformation'
>

@Injectable()
export class InstanceService {
  private static BASE_CONFIG_URL = environment.apiUrl + '/api/v1/config'
  private static BASE_SERVER_URL = environment.apiUrl + '/api/v1/server'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private markdownService: MarkdownService,
    private serverService: ServerService
  ) {
  }

  getAbout () {
    return this.authHttp.get<About>(InstanceService.BASE_CONFIG_URL + '/about')
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  // ---------------------------------------------------------------------------

  updateInstanceBanner (formData: FormData) {
    const url = InstanceService.BASE_CONFIG_URL + '/instance-banner/pick'

    return this.authHttp.post(url, formData)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteInstanceBanner () {
    const url = InstanceService.BASE_CONFIG_URL + '/instance-banner'

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  updateInstanceAvatar (formData: FormData) {
    const url = InstanceService.BASE_CONFIG_URL + '/instance-avatar/pick'

    return this.authHttp.post(url, formData)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteInstanceAvatar () {
    const url = InstanceService.BASE_CONFIG_URL + '/instance-avatar'

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  contactAdministrator (fromEmail: string, fromName: string, subject: string, message: string) {
    const body = {
      fromEmail,
      fromName,
      subject,
      body: message
    }

    return this.authHttp.post(InstanceService.BASE_SERVER_URL + '/contact', body)
               .pipe(catchError(res => this.restExtractor.handleError(res)))

  }

  async buildHtml (about: About) {
    const html: AboutHTML = {
      terms: '',
      codeOfConduct: '',
      moderationInformation: '',
      administrator: '',
      creationReason: '',
      maintenanceLifetime: '',
      businessModel: '',
      hardwareInformation: ''
    }

    for (const key of objectKeysTyped(html)) {
      html[key] = await this.markdownService.enhancedMarkdownToHTML({ markdown: about.instance[key] })
    }

    return html
  }

  buildTranslatedLanguages (about: About) {
    return forkJoin([
      this.serverService.getVideoLanguages(),
      this.serverService.getServerLocale()
    ]).pipe(
      map(([ languagesArray, translations ]) => {
        return about.instance.languages
          .map(l => {
            const languageObj = languagesArray.find(la => la.id === l)
            if (!languageObj) {
              logger.error(`Cannot find language ${l} in available languages`)
              return ''
            }

            return peertubeTranslate(languageObj.label, translations)
          })
      })
    )
  }

  buildTranslatedCategories (about: About) {
    return forkJoin([
      this.serverService.getVideoCategories(),
      this.serverService.getServerLocale()
    ]).pipe(
      map(([ categoriesArray, translations ]) => {
        return about.instance.categories
          .map(c => {
            const categoryObj = categoriesArray.find(ca => ca.id === c)
            if (!categoryObj) {
              logger.error(`Cannot find instance category ${c} in available categories`)
              return ''
            }

            return peertubeTranslate(categoryObj.label, translations)
          })
      })
    )
  }
}
