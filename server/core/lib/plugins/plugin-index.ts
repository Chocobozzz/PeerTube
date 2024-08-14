import {
  PeerTubePluginIndex,
  PeertubePluginIndexList,
  PeertubePluginLatestVersionRequest,
  PeertubePluginLatestVersionResponse,
  ResultList
} from '@peertube/peertube-models'
import { sanitizeUrl } from '@server/helpers/core-utils.js'
import { logger } from '@server/helpers/logger.js'
import { doJSONRequest } from '@server/helpers/requests.js'
import { CONFIG } from '@server/initializers/config.js'
import { PEERTUBE_VERSION } from '@server/initializers/constants.js'
import { PluginModel } from '@server/models/server/plugin.js'
import { PluginManager } from './plugin-manager.js'

export async function listAvailablePluginsFromIndex (options: PeertubePluginIndexList) {
  const { start = 0, count = 20, search, sort = 'npmName', pluginType } = options

  const searchParams: PeertubePluginIndexList & Record<string, string | number> = {
    start,
    count,
    sort,
    pluginType,
    search,
    currentPeerTubeEngine: options.currentPeerTubeEngine || PEERTUBE_VERSION
  }

  const uri = CONFIG.PLUGINS.INDEX.URL + '/api/v1/plugins'

  try {
    const { body } = await doJSONRequest<any>(uri, { searchParams, preventSSRF: false })

    logger.debug('Got result from PeerTube index.', { body })

    addInstanceInformation(body)

    return body as ResultList<PeerTubePluginIndex>
  } catch (err) {
    logger.error('Cannot list available plugins from index %s.', uri, { err })
    return undefined
  }
}

function addInstanceInformation (result: ResultList<PeerTubePluginIndex>) {
  for (const d of result.data) {
    d.installed = PluginManager.Instance.isRegistered(d.npmName)
    d.name = PluginModel.normalizePluginName(d.npmName)
  }

  return result
}

export async function getLatestPluginsVersion (npmNames: string[]): Promise<PeertubePluginLatestVersionResponse> {
  const bodyRequest: PeertubePluginLatestVersionRequest = {
    npmNames,
    currentPeerTubeEngine: PEERTUBE_VERSION
  }

  const uri = sanitizeUrl(CONFIG.PLUGINS.INDEX.URL) + '/api/v1/plugins/latest-version'
  const { body } = await doJSONRequest<PeertubePluginLatestVersionResponse>(uri, { json: bodyRequest, method: 'POST', preventSSRF: false })

  return body
}

export async function getLatestPluginVersion (npmName: string) {
  const results = await getLatestPluginsVersion([ npmName ])

  if (Array.isArray(results) === false || results.length !== 1) {
    logger.warn('Cannot get latest supported plugin version of %s.', npmName)
    return undefined
  }

  return results[0].latestVersion
}
