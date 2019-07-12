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
import { ManagePlugin } from '@shared/models/plugins/manage-plugin.model'
import { InstallOrUpdatePlugin } from '@shared/models/plugins/install-plugin.model'
import { RegisterSettingOptions } from '@shared/models/plugins/register-setting.model'

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
        label: this.i18n('Plugins'),
        value: PluginType.PLUGIN
      },
      {
        label: this.i18n('Themes'),
        value: PluginType.THEME
      }
    ]
  }

  getPluginTypeLabel (type: PluginType) {
    if (type === PluginType.PLUGIN) {
      return this.i18n('plugin')
    }

    return this.i18n('theme')
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

  getPlugin (npmName: string) {
    const path = PluginApiService.BASE_APPLICATION_URL + '/' + npmName

    return this.authHttp.get<PeerTubePlugin>(path)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  getPluginRegisteredSettings (pluginName: string, pluginType: PluginType) {
    const path = PluginApiService.BASE_APPLICATION_URL + '/' + this.nameToNpmName(pluginName, pluginType) + '/registered-settings'

    return this.authHttp.get<{ settings: RegisterSettingOptions[] }>(path)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  updatePluginSettings (pluginName: string, pluginType: PluginType, settings: any) {
    const path = PluginApiService.BASE_APPLICATION_URL + '/' + this.nameToNpmName(pluginName, pluginType) + '/settings'

    return this.authHttp.put(path, { settings })
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  uninstall (pluginName: string, pluginType: PluginType) {
    const body: ManagePlugin = {
      npmName: this.nameToNpmName(pluginName, pluginType)
    }

    return this.authHttp.post(PluginApiService.BASE_APPLICATION_URL + '/uninstall', body)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  update (pluginName: string, pluginType: PluginType) {
    const body: ManagePlugin = {
      npmName: this.nameToNpmName(pluginName, pluginType)
    }

    return this.authHttp.post(PluginApiService.BASE_APPLICATION_URL + '/update', body)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  install (npmName: string) {
    const body: InstallOrUpdatePlugin = {
      npmName
    }

    return this.authHttp.post(PluginApiService.BASE_APPLICATION_URL + '/install', body)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  nameToNpmName (name: string, type: PluginType) {
    const prefix = type === PluginType.PLUGIN
      ? 'peertube-plugin-'
      : 'peertube-theme-'

    return prefix + name
  }

  pluginTypeFromNpmName (npmName: string) {
    return npmName.startsWith('peertube-plugin-')
      ? PluginType.PLUGIN
      : PluginType.THEME
  }
}
