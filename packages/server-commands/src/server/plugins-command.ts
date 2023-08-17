/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { readJSON, writeJSON } from 'fs-extra/esm'
import { join } from 'path'
import {
  HttpStatusCode,
  HttpStatusCodeType,
  PeerTubePlugin,
  PeerTubePluginIndex,
  PeertubePluginIndexList,
  PluginPackageJSON,
  PluginTranslation,
  PluginType_Type,
  PublicServerSetting,
  RegisteredServerSettings,
  ResultList
} from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class PluginsCommand extends AbstractCommand {

  static getPluginTestPath (suffix = '') {
    return buildAbsoluteFixturePath('peertube-plugin-test' + suffix)
  }

  list (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string
    pluginType?: PluginType_Type
    uninstalled?: boolean
  }) {
    const { start, count, sort, pluginType, uninstalled } = options
    const path = '/api/v1/plugins'

    return this.getRequestBody<ResultList<PeerTubePlugin>>({
      ...options,

      path,
      query: {
        start,
        count,
        sort,
        pluginType,
        uninstalled
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listAvailable (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string
    pluginType?: PluginType_Type
    currentPeerTubeEngine?: string
    search?: string
    expectedStatus?: HttpStatusCodeType
  }) {
    const { start, count, sort, pluginType, search, currentPeerTubeEngine } = options
    const path = '/api/v1/plugins/available'

    const query: PeertubePluginIndexList = {
      start,
      count,
      sort,
      pluginType,
      currentPeerTubeEngine,
      search
    }

    return this.getRequestBody<ResultList<PeerTubePluginIndex>>({
      ...options,

      path,
      query,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  get (options: OverrideCommandOptions & {
    npmName: string
  }) {
    const path = '/api/v1/plugins/' + options.npmName

    return this.getRequestBody<PeerTubePlugin>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  updateSettings (options: OverrideCommandOptions & {
    npmName: string
    settings: any
  }) {
    const { npmName, settings } = options
    const path = '/api/v1/plugins/' + npmName + '/settings'

    return this.putBodyRequest({
      ...options,

      path,
      fields: { settings },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  getRegisteredSettings (options: OverrideCommandOptions & {
    npmName: string
  }) {
    const path = '/api/v1/plugins/' + options.npmName + '/registered-settings'

    return this.getRequestBody<RegisteredServerSettings>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getPublicSettings (options: OverrideCommandOptions & {
    npmName: string
  }) {
    const { npmName } = options
    const path = '/api/v1/plugins/' + npmName + '/public-settings'

    return this.getRequestBody<PublicServerSetting>({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getTranslations (options: OverrideCommandOptions & {
    locale: string
  }) {
    const { locale } = options
    const path = '/plugins/translations/' + locale + '.json'

    return this.getRequestBody<PluginTranslation>({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  install (options: OverrideCommandOptions & {
    path?: string
    npmName?: string
    pluginVersion?: string
  }) {
    const { npmName, path, pluginVersion } = options
    const apiPath = '/api/v1/plugins/install'

    return this.postBodyRequest({
      ...options,

      path: apiPath,
      fields: { npmName, path, pluginVersion },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  update (options: OverrideCommandOptions & {
    path?: string
    npmName?: string
  }) {
    const { npmName, path } = options
    const apiPath = '/api/v1/plugins/update'

    return this.postBodyRequest({
      ...options,

      path: apiPath,
      fields: { npmName, path },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  uninstall (options: OverrideCommandOptions & {
    npmName: string
  }) {
    const { npmName } = options
    const apiPath = '/api/v1/plugins/uninstall'

    return this.postBodyRequest({
      ...options,

      path: apiPath,
      fields: { npmName },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  getCSS (options: OverrideCommandOptions = {}) {
    const path = '/plugins/global.css'

    return this.getRequestText({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getExternalAuth (options: OverrideCommandOptions & {
    npmName: string
    npmVersion: string
    authName: string
    query?: any
  }) {
    const { npmName, npmVersion, authName, query } = options

    const path = '/plugins/' + npmName + '/' + npmVersion + '/auth/' + authName

    return this.getRequest({
      ...options,

      path,
      query,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200,
      redirects: 0
    })
  }

  updatePackageJSON (npmName: string, json: any) {
    const path = this.getPackageJSONPath(npmName)

    return writeJSON(path, json)
  }

  getPackageJSON (npmName: string): Promise<PluginPackageJSON> {
    const path = this.getPackageJSONPath(npmName)

    return readJSON(path)
  }

  private getPackageJSONPath (npmName: string) {
    return this.server.servers.buildDirectory(join('plugins', 'node_modules', npmName, 'package.json'))
  }
}
