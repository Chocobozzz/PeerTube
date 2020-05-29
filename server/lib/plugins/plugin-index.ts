import { doRequest } from '../../helpers/requests'
import { CONFIG } from '../../initializers/config'
import {
  PeertubePluginLatestVersionRequest,
  PeertubePluginLatestVersionResponse
} from '../../../shared/models/plugins/peertube-plugin-latest-version.model'
import { PeertubePluginIndexList } from '../../../shared/models/plugins/peertube-plugin-index-list.model'
import { ResultList } from '../../../shared/models'
import { PeerTubePluginIndex } from '../../../shared/models/plugins/peertube-plugin-index.model'
import { PluginModel } from '../../models/server/plugin'
import { PluginManager } from './plugin-manager'
import { logger } from '../../helpers/logger'
import { PEERTUBE_VERSION } from '../../initializers/constants'
import { sanitizeUrl } from '@server/helpers/core-utils'

async function listAvailablePluginsFromIndex (options: PeertubePluginIndexList) {
  const { start = 0, count = 20, search, sort = 'npmName', pluginType } = options

  const qs: PeertubePluginIndexList = {
    start,
    count,
    sort,
    pluginType,
    search,
    currentPeerTubeEngine: options.currentPeerTubeEngine || PEERTUBE_VERSION
  }

  const uri = CONFIG.PLUGINS.INDEX.URL + '/api/v1/plugins'

  try {
    const { body } = await doRequest<any>({ uri, qs, json: true })

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

async function getLatestPluginsVersion (npmNames: string[]): Promise<PeertubePluginLatestVersionResponse> {
  const bodyRequest: PeertubePluginLatestVersionRequest = {
    npmNames,
    currentPeerTubeEngine: PEERTUBE_VERSION
  }

  const uri = sanitizeUrl(CONFIG.PLUGINS.INDEX.URL) + '/api/v1/plugins/latest-version'

  const { body } = await doRequest<any>({ uri, body: bodyRequest, json: true, method: 'POST' })

  return body
}

export {
  listAvailablePluginsFromIndex,
  getLatestPluginsVersion
}
