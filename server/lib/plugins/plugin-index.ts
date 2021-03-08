import { sanitizeUrl } from '@server/helpers/core-utils'
import { ResultList } from '../../../shared/models'
import { PeertubePluginIndexList } from '../../../shared/models/plugins/peertube-plugin-index-list.model'
import { PeerTubePluginIndex } from '../../../shared/models/plugins/peertube-plugin-index.model'
import {
  PeertubePluginLatestVersionRequest,
  PeertubePluginLatestVersionResponse
} from '../../../shared/models/plugins/peertube-plugin-latest-version.model'
import { logger } from '../../helpers/logger'
import { doJSONRequest } from '../../helpers/requests'
import { CONFIG } from '../../initializers/config'
import { PEERTUBE_VERSION } from '../../initializers/constants'
import { PluginModel } from '../../models/server/plugin'
import { PluginManager } from './plugin-manager'

async function listAvailablePluginsFromIndex (options: PeertubePluginIndexList) {
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
    const { body } = await doJSONRequest<any>(uri, { searchParams })

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

  const options = {
    json: bodyRequest,
    method: 'POST' as 'POST'
  }
  const { body } = await doJSONRequest<PeertubePluginLatestVersionResponse>(uri, options)

  return body
}

export {
  listAvailablePluginsFromIndex,
  getLatestPluginsVersion
}
