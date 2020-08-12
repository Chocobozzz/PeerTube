import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { CustomConfig } from '@shared/models'
import { environment } from '../../../../environments/environment'

@Injectable()
export class ConfigService {
  private static BASE_APPLICATION_URL = environment.apiUrl + '/api/v1/config'

  videoQuotaOptions: { value: number, label: string, disabled?: boolean }[] = []
  videoQuotaDailyOptions: { value: number, label: string, disabled?: boolean }[] = []

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
    ) {
    this.videoQuotaOptions = [
      { value: undefined, label: 'Default quota', disabled: true },
      { value: -1, label: $localize`Unlimited` },
      { value: undefined, label: '─────', disabled: true },
      { value: 0, label: $localize`None - no upload possible` },
      { value: 100 * 1024 * 1024, label: $localize`100MB` },
      { value: 500 * 1024 * 1024, label: $localize`500MB` },
      { value: 1024 * 1024 * 1024, label: $localize`1GB` },
      { value: 5 * 1024 * 1024 * 1024, label: $localize`5GB` },
      { value: 20 * 1024 * 1024 * 1024, label: $localize`20GB` },
      { value: 50 * 1024 * 1024 * 1024, label: $localize`50GB` }
    ]

    this.videoQuotaDailyOptions = [
      { value: undefined, label: 'Default daily upload limit', disabled: true },
      { value: -1, label: $localize`Unlimited` },
      { value: undefined, label: '─────', disabled: true },
      { value: 0, label: $localize`None - no upload possible` },
      { value: 10 * 1024 * 1024, label: $localize`10MB` },
      { value: 50 * 1024 * 1024, label: $localize`50MB` },
      { value: 100 * 1024 * 1024, label: $localize`100MB` },
      { value: 500 * 1024 * 1024, label: $localize`500MB` },
      { value: 2 * 1024 * 1024 * 1024, label: $localize`2GB` },
      { value: 5 * 1024 * 1024 * 1024, label: $localize`5GB` }
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
