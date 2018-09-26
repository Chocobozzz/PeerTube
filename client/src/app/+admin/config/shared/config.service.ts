import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { CustomConfig } from '../../../../../../shared/models/server/custom-config.model'
import { environment } from '../../../../environments/environment'
import { RestExtractor } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Injectable()
export class ConfigService {
  private static BASE_APPLICATION_URL = environment.apiUrl + '/api/v1/config'

  videoQuotaOptions: { value: number, label: string }[] = []
  videoQuotaDailyOptions: { value: number, label: string }[] = []

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private i18n: I18n
  ) {
    this.videoQuotaOptions = [
      { value: -1, label: this.i18n('Unlimited') },
      { value: 0, label: '0' },
      { value: 100 * 1024 * 1024, label: this.i18n('100MB') },
      { value: 500 * 1024 * 1024, label: this.i18n('500MB') },
      { value: 1024 * 1024 * 1024, label: this.i18n('1GB') },
      { value: 5 * 1024 * 1024 * 1024, label: this.i18n('5GB') },
      { value: 20 * 1024 * 1024 * 1024, label: this.i18n('20GB') },
      { value: 50 * 1024 * 1024 * 1024, label: this.i18n('50GB') }
    ]

    this.videoQuotaDailyOptions = [
      { value: -1, label: this.i18n('Unlimited') },
      { value: 0, label: '0' },
      { value: 10 * 1024 * 1024, label: this.i18n('10MB') },
      { value: 50 * 1024 * 1024, label: this.i18n('50MB') },
      { value: 100 * 1024 * 1024, label: this.i18n('100MB') },
      { value: 500 * 1024 * 1024, label: this.i18n('500MB') },
      { value: 2 * 1024 * 1024 * 1024, label: this.i18n('2GB') },
      { value: 5 * 1024 * 1024 * 1024, label: this.i18n('5GB') }
    ]
  }

  getCustomConfig () {
    return this.authHttp.get<CustomConfig>(ConfigService.BASE_APPLICATION_URL + '/custom')
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  updateCustomConfig (data: CustomConfig) {
    return this.authHttp.put<CustomConfig>(ConfigService.BASE_APPLICATION_URL + '/custom', data)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }
}
