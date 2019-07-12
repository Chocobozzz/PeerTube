import { makeGetRequest, makePostBodyRequest } from '../requests/requests'
import { PluginType } from '../../models/plugins/plugin.type'

function listPlugins (parameters: {
  url: string,
  accessToken: string,
  start?: number,
  count?: number,
  sort?: string,
  type?: PluginType,
  expectedStatus?: number
}) {
  const { url, accessToken, start, count, sort, type, expectedStatus = 200 } = parameters
  const path = '/api/v1/plugins'

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    query: {
      start,
      count,
      sort,
      type
    },
    statusCodeExpected: expectedStatus
  })
}

function getPlugin (parameters: {
  url: string,
  accessToken: string,
  npmName: string,
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

function getPluginSettings (parameters: {
  url: string,
  accessToken: string,
  npmName: string,
  expectedStatus?: number
}) {
  const { url, accessToken, npmName, expectedStatus = 200 } = parameters
  const path = '/api/v1/plugins/' + npmName + '/settings'

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    statusCodeExpected: expectedStatus
  })
}

function getPluginRegisteredSettings (parameters: {
  url: string,
  accessToken: string,
  npmName: string,
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

function installPlugin (parameters: {
  url: string,
  accessToken: string,
  path?: string,
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
  url: string,
  accessToken: string,
  path?: string,
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
  url: string,
  accessToken: string,
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

export {
  listPlugins,
  installPlugin,
  updatePlugin,
  getPlugin,
  uninstallPlugin,
  getPluginSettings,
  getPluginRegisteredSettings
}
