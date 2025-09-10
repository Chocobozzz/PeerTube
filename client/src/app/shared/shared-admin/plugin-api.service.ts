import { catchError } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { ComponentPagination, RestExtractor, RestService } from '@app/core'
import { PluginService } from '@app/core/plugins/plugin.service'
import {
  InstallOrUpdatePlugin,
  ManagePlugin,
  PeerTubePlugin,
  PeerTubePluginIndex,
  PluginType,
  PluginType_Type,
  RegisteredServerSettings,
  ResultList
} from '@peertube/peertube-models'
import { environment } from '../../../environments/environment'

@Injectable()
export class PluginApiService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private restService = inject(RestService)
  private pluginService = inject(PluginService)

  private static BASE_PLUGIN_URL = environment.apiUrl + '/api/v1/plugins'

  getPluginTypeLabel (type: PluginType_Type) {
    if (type === PluginType.PLUGIN) {
      return $localize`plugin`
    }

    return $localize`theme`
  }

  getPlugins (
    pluginType: PluginType_Type,
    componentPagination: ComponentPagination,
    sort: string
  ) {
    const pagination = this.restService.componentToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)
    params = params.append('pluginType', pluginType.toString())

    return this.authHttp.get<ResultList<PeerTubePlugin>>(PluginApiService.BASE_PLUGIN_URL, { params })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  searchAvailablePlugins (
    pluginType: PluginType_Type,
    componentPagination: ComponentPagination,
    sort: string,
    search?: string
  ) {
    const pagination = this.restService.componentToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)
    params = params.append('pluginType', pluginType.toString())

    if (search) params = params.append('search', search)

    return this.authHttp.get<ResultList<PeerTubePluginIndex>>(PluginApiService.BASE_PLUGIN_URL + '/available', { params })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  getPlugin (npmName: string) {
    const path = PluginApiService.BASE_PLUGIN_URL + '/' + npmName

    return this.authHttp.get<PeerTubePlugin>(path)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  getPluginRegisteredSettings (pluginName: string, pluginType: PluginType_Type) {
    const npmName = this.pluginService.nameToNpmName(pluginName, pluginType)
    const path = PluginApiService.BASE_PLUGIN_URL + '/' + npmName + '/registered-settings'

    return this.authHttp.get<RegisteredServerSettings>(path)
      .pipe(
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  updatePluginSettings (pluginName: string, pluginType: PluginType_Type, settings: any) {
    const npmName = this.pluginService.nameToNpmName(pluginName, pluginType)
    const path = PluginApiService.BASE_PLUGIN_URL + '/' + npmName + '/settings'

    return this.authHttp.put(path, { settings })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  uninstall (pluginName: string, pluginType: PluginType_Type) {
    const body: ManagePlugin = {
      npmName: this.pluginService.nameToNpmName(pluginName, pluginType)
    }

    return this.authHttp.post(PluginApiService.BASE_PLUGIN_URL + '/uninstall', body)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  update (pluginName: string, pluginType: PluginType_Type) {
    const body: ManagePlugin = {
      npmName: this.pluginService.nameToNpmName(pluginName, pluginType)
    }

    return this.authHttp.post(PluginApiService.BASE_PLUGIN_URL + '/update', body)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  install (npmName: string) {
    const body: InstallOrUpdatePlugin = {
      npmName
    }

    return this.authHttp.post(PluginApiService.BASE_PLUGIN_URL + '/install', body)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  getPluginOrThemeHref (type: PluginType_Type, name: string) {
    const typeString = type === PluginType.PLUGIN
      ? 'plugin'
      : 'theme'

    return `https://www.npmjs.com/package/peertube-${typeString}-${name}`
  }
}
