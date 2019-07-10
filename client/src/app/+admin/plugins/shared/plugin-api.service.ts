import { catchError } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { environment } from '../../../../environments/environment'
import { RestExtractor, RestService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { PluginType } from '@shared/models/plugins/plugin.type'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { ResultList } from '@shared/models'
import { PeerTubePlugin } from '@shared/models/plugins/peertube-plugin.model'

@Injectable()
export class PluginApiService {
  private static BASE_APPLICATION_URL = environment.apiUrl + '/api/v1/plugins'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService,
    private i18n: I18n
  ) { }

  getPluginTypeOptions () {
    return [
      {
        label: this.i18n('Plugin'),
        value: PluginType.PLUGIN
      },
      {
        label: this.i18n('Theme'),
        value: PluginType.THEME
      }
    ]
  }

  getPlugins (
    type: PluginType,
    componentPagination: ComponentPagination,
    sort: string
  ) {
    const pagination = this.restService.componentPaginationToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)
    params = params.append('type', type.toString())

    return this.authHttp.get<ResultList<PeerTubePlugin>>(PluginApiService.BASE_APPLICATION_URL, { params })
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }
}
