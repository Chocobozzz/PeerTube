import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestService } from '../rest'
import { About } from '../../../../../shared/models/server'
import { MarkdownService } from '@app/shared/renderer'
import { peertubeTranslate } from '@shared/models'
import { ServerService } from '@app/core'

@Injectable()
export class InstanceService {
  private static BASE_CONFIG_URL = environment.apiUrl + '/api/v1/config'
  private static BASE_SERVER_URL = environment.apiUrl + '/api/v1/server'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor,
    private markdownService: MarkdownService,
    private serverService: ServerService
  ) {
  }

  getAbout () {
    return this.authHttp.get<About>(InstanceService.BASE_CONFIG_URL + '/about')
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

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
    const html = {
      description: '',
      terms: '',
      codeOfConduct: '',
      moderationInformation: '',
      administrator: '',
      hardwareInformation: ''
    }

    for (const key of Object.keys(html)) {
      html[ key ] = await this.markdownService.textMarkdownToHTML(about.instance[ key ])
    }

    return html
  }

  buildTranslatedLanguages (about: About, translations: any) {
    const languagesArray = this.serverService.getVideoLanguages()

    return about.instance.languages
                .map(l => {
                  const languageObj = languagesArray.find(la => la.id === l)

                  return peertubeTranslate(languageObj.label, translations)
                })
  }

  buildTranslatedCategories (about: About, translations: any) {
    const categoriesArray = this.serverService.getVideoCategories()

    return about.instance.categories
                .map(c => {
                  const categoryObj = categoriesArray.find(ca => ca.id === c)

                  return peertubeTranslate(categoryObj.label, translations)
                })
  }
}
