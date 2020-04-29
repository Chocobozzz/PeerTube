import { makeGetRequest, makePostBodyRequest, makePutBodyRequest } from '../requests/requests'
import { PluginType } from '../../models/plugins/plugin.type'
import { PeertubePluginIndexList } from '../../models/plugins/peertube-plugin-index-list.model'
import { readJSON, writeJSON } from 'fs-extra'
import { ServerInfo } from './servers'
import { root } from '../miscs/miscs'
import { join } from 'path'

function listPlugins (parameters: {
  url: string
  accessToken: string
  start?: number
  count?: number
  sort?: string
  pluginType?: PluginType
  uninstalled?: boolean
  expectedStatus?: number
}) {
  const { url, accessToken, start, count, sort, pluginType, uninstalled, expectedStatus = 200 } = parameters
  const path = '/api/v1/plugins'

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    query: {
      start,
      count,
      sort,
      pluginType,
      uninstalled
    },
    statusCodeExpected: expectedStatus
  })
}

function listAvailablePlugins (parameters: {
  url: string
  accessToken: string
  start?: number
  count?: number
  sort?: string
  pluginType?: PluginType
  currentPeerTubeEngine?: string
  search?: string
  expectedStatus?: number
}) {
  const { url, accessToken, start, count, sort, pluginType, search, currentPeerTubeEngine, expectedStatus = 200 } = parameters
  const path = '/api/v1/plugins/available'

  const query: PeertubePluginIndexList = {
    start,
    count,
    sort,
    pluginType,
    currentPeerTubeEngine,
    search
  }

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    query,
    statusCodeExpected: expectedStatus
  })
}

function getPlugin (parameters: {
  url: string
  accessToken: string
  npmName: string
  expectedStatus?: number
}) {
  const { url, accessToken, npmName, expectedStatus = 200 } = parameters
  const path = '/api/v1/plugins/' + npmName

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    statusCodeExpected: expectedStatus
  })
}

function updatePluginSettings (parameters: {
  url: string
  accessToken: string
  npmName: string
  settings: any
  expectedStatus?: number
}) {
  const { url, accessToken, npmName, settings, expectedStatus = 204 } = parameters
  const path = '/api/v1/plugins/' + npmName + '/settings'

  return makePutBodyRequest({
    url,
    path,
    token: accessToken,
    fields: { settings },
    statusCodeExpected: expectedStatus
  })
}

function getPluginRegisteredSettings (parameters: {
  url: string
  accessToken: string
  npmName: string
  expectedStatus?: number
}) {
  const { url, accessToken, npmName, expectedStatus = 200 } = parameters
  const path = '/api/v1/plugins/' + npmName + '/registered-settings'

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    statusCodeExpected: expectedStatus
  })
}

function getPublicSettings (parameters: {
  url: string
  npmName: string
  expectedStatus?: number
}) {
  const { url, npmName, expectedStatus = 200 } = parameters
  const path = '/api/v1/plugins/' + npmName + '/public-settings'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: expectedStatus
  })
}

function getPluginTranslations (parameters: {
  url: string
  locale: string
  expectedStatus?: number
}) {
  const { url, locale, expectedStatus = 200 } = parameters
  const path = '/plugins/translations/' + locale + '.json'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: expectedStatus
  })
}

function installPlugin (parameters: {
  url: string
  accessToken: string
  path?: string
  npmName?: string
  expectedStatus?: number
}) {
  const { url, accessToken, npmName, path, expectedStatus = 200 } = parameters
  const apiPath = '/api/v1/plugins/install'

  return makePostBodyRequest({
    url,
    path: apiPath,
    token: accessToken,
    fields: { npmName, path },
    statusCodeExpected: expectedStatus
  })
}

function updatePlugin (parameters: {
  url: string
  accessToken: string
  path?: string
  npmName?: string
  expectedStatus?: number
}) {
  const { url, accessToken, npmName, path, expectedStatus = 200 } = parameters
  const apiPath = '/api/v1/plugins/update'

  return makePostBodyRequest({
    url,
    path: apiPath,
    token: accessToken,
    fields: { npmName, path },
    statusCodeExpected: expectedStatus
  })
}

function uninstallPlugin (parameters: {
  url: string
  accessToken: string
  npmName: string
  expectedStatus?: number
}) {
  const { url, accessToken, npmName, expectedStatus = 204 } = parameters
  const apiPath = '/api/v1/plugins/uninstall'

  return makePostBodyRequest({
    url,
    path: apiPath,
    token: accessToken,
    fields: { npmName },
    statusCodeExpected: expectedStatus
  })
}

function getPluginsCSS (url: string) {
  const path = '/plugins/global.css'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

function getPackageJSONPath (server: ServerInfo, npmName: string) {
  return join(root(), 'test' + server.internalServerNumber, 'plugins', 'node_modules', npmName, 'package.json')
}

function updatePluginPackageJSON (server: ServerInfo, npmName: string, json: any) {
  const path = getPackageJSONPath(server, npmName)

  return writeJSON(path, json)
}

function getPluginPackageJSON (server: ServerInfo, npmName: string) {
  const path = getPackageJSONPath(server, npmName)

  return readJSON(path)
}

function getPluginTestPath (suffix = '') {
  return join(root(), 'server', 'tests', 'fixtures', 'peertube-plugin-test' + suffix)
}

function getExternalAuth (options: {
  url: string
  npmName: string
  npmVersion: string
  authName: string
  query?: any
  statusCodeExpected?: number
}) {
  const { url, npmName, npmVersion, authName, statusCodeExpected, query } = options

  const path = '/plugins/' + npmName + '/' + npmVersion + '/auth/' + authName

  return makeGetRequest({
    url,
    path,
    query,
    statusCodeExpected: statusCodeExpected || 200,
    redirects: 0
  })
}

export {
  listPlugins,
  listAvailablePlugins,
  installPlugin,
  getPluginTranslations,
  getPluginsCSS,
  updatePlugin,
  getPlugin,
  uninstallPlugin,
  updatePluginSettings,
  getPluginRegisteredSettings,
  getPackageJSONPath,
  updatePluginPackageJSON,
  getPluginPackageJSON,
  getPluginTestPath,
  getPublicSettings,
  getExternalAuth
}
