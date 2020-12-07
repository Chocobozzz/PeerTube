/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { readJSON, writeJSON } from 'fs-extra'
import { join } from 'path'
import { RegisteredServerSettings } from '@shared/models'
import { PeertubePluginIndexList } from '../../models/plugins/peertube-plugin-index-list.model'
import { PluginType } from '../../models/plugins/plugin.type'
import { buildServerDirectory, root } from '../miscs/miscs'
import { makeGetRequest, makePostBodyRequest, makePutBodyRequest } from '../requests/requests'
import { ServerInfo } from './servers'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function listPlugins (parameters: {
  url: string
  accessToken: string
  start?: number
  count?: number
  sort?: string
  pluginType?: PluginType
  uninstalled?: boolean
  expectedStatus?: HttpStatusCode
}) {
  const { url, accessToken, start, count, sort, pluginType, uninstalled, expectedStatus = HttpStatusCode.OK_200 } = parameters
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
  expectedStatus?: HttpStatusCode
}) {
  const {
    url,
    accessToken,
    start,
    count,
    sort,
    pluginType,
    search,
    currentPeerTubeEngine,
    expectedStatus = HttpStatusCode.OK_200
  } = parameters
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
  expectedStatus?: HttpStatusCode
}) {
  const { url, accessToken, npmName, expectedStatus = HttpStatusCode.OK_200 } = parameters
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
  expectedStatus?: HttpStatusCode
}) {
  const { url, accessToken, npmName, settings, expectedStatus = HttpStatusCode.NO_CONTENT_204 } = parameters
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
  expectedStatus?: HttpStatusCode
}) {
  const { url, accessToken, npmName, expectedStatus = HttpStatusCode.OK_200 } = parameters
  const path = '/api/v1/plugins/' + npmName + '/registered-settings'

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    statusCodeExpected: expectedStatus
  })
}

async function testHelloWorldRegisteredSettings (server: ServerInfo) {
  const res = await getPluginRegisteredSettings({
    url: server.url,
    accessToken: server.accessToken,
    npmName: 'peertube-plugin-hello-world'
  })

  const registeredSettings = (res.body as RegisteredServerSettings).registeredSettings

  expect(registeredSettings).to.have.length.at.least(1)

  const adminNameSettings = registeredSettings.find(s => s.name === 'admin-name')
  expect(adminNameSettings).to.not.be.undefined
}

function getPublicSettings (parameters: {
  url: string
  npmName: string
  expectedStatus?: HttpStatusCode
}) {
  const { url, npmName, expectedStatus = HttpStatusCode.OK_200 } = parameters
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
  expectedStatus?: HttpStatusCode
}) {
  const { url, locale, expectedStatus = HttpStatusCode.OK_200 } = parameters
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
  expectedStatus?: HttpStatusCode
}) {
  const { url, accessToken, npmName, path, expectedStatus = HttpStatusCode.OK_200 } = parameters
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
  expectedStatus?: HttpStatusCode
}) {
  const { url, accessToken, npmName, path, expectedStatus = HttpStatusCode.OK_200 } = parameters
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
  expectedStatus?: HttpStatusCode
}) {
  const { url, accessToken, npmName, expectedStatus = HttpStatusCode.NO_CONTENT_204 } = parameters
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
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getPackageJSONPath (server: ServerInfo, npmName: string) {
  return buildServerDirectory(server, join('plugins', 'node_modules', npmName, 'package.json'))
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
  statusCodeExpected?: HttpStatusCode
}) {
  const { url, npmName, npmVersion, authName, statusCodeExpected, query } = options

  const path = '/plugins/' + npmName + '/' + npmVersion + '/auth/' + authName

  return makeGetRequest({
    url,
    path,
    query,
    statusCodeExpected: statusCodeExpected || HttpStatusCode.OK_200,
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
  testHelloWorldRegisteredSettings,
  updatePluginSettings,
  getPluginRegisteredSettings,
  getPackageJSONPath,
  updatePluginPackageJSON,
  getPluginPackageJSON,
  getPluginTestPath,
  getPublicSettings,
  getExternalAuth
}
