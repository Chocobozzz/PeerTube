import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { CustomConfig } from '@shared/models'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { environment } from '../../../../environments/environment'

@Injectable()
export class ConfigService {
  private static BASE_APPLICATION_URL = environment.apiUrl + '/api/v1/config'

  videoQuotaOptions: SelectOptionsItem[] = []
  videoQuotaDailyOptions: SelectOptionsItem[] = []
  transcodingThreadOptions: SelectOptionsItem[] = []

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {
    this.videoQuotaOptions = [
      { id: -1, label: $localize`Unlimited` },
      { id: 0, label: $localize`None - no upload possible` },
      { id: 100 * 1024 * 1024, label: $localize`100MB` },
      { id: 500 * 1024 * 1024, label: $localize`500MB` },
      { id: 1024 * 1024 * 1024, label: $localize`1GB` },
      { id: 5 * 1024 * 1024 * 1024, label: $localize`5GB` },
      { id: 20 * 1024 * 1024 * 1024, label: $localize`20GB` },
      { id: 50 * 1024 * 1024 * 1024, label: $localize`50GB` },
      { id: 100 * 1024 * 1024 * 1024, label: $localize`100GB` },
      { id: 200 * 1024 * 1024 * 1024, label: $localize`200GB` },
      { id: 500 * 1024 * 1024 * 1024, label: $localize`500GB` }
    ]

    this.videoQuotaDailyOptions = [
      { id: -1, label: $localize`Unlimited` },
      { id: 0, label: $localize`None - no upload possible` },
      { id: 10 * 1024 * 1024, label: $localize`10MB` },
      { id: 50 * 1024 * 1024, label: $localize`50MB` },
      { id: 100 * 1024 * 1024, label: $localize`100MB` },
      { id: 500 * 1024 * 1024, label: $localize`500MB` },
      { id: 2 * 1024 * 1024 * 1024, label: $localize`2GB` },
      { id: 5 * 1024 * 1024 * 1024, label: $localize`5GB` },
      { id: 10 * 1024 * 1024 * 1024, label: $localize`10GB` },
      { id: 20 * 1024 * 1024 * 1024, label: $localize`20GB` },
      { id: 50 * 1024 * 1024 * 1024, label: $localize`50GB` }
    ]

    this.transcodingThreadOptions = [
      { id: 0, label: $localize`Auto (via ffmpeg)` },
      { id: 1, label: '1' },
      { id: 2, label: '2' },
      { id: 4, label: '4' },
      { id: 8, label: '8' },
      { id: 12, label: '12' },
      { id: 16, label: '16' },
      { id: 32, label: '32' }
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
