import { PluginModel } from '@server/models/server/plugin'
import { PeerTubeHelpers } from '@server/typings/plugins'

function buildPluginHelpers (npmName: string, plugin: PluginModel): PeerTubeHelpers {
  const logger = buildLogger(npmName)

  return {
    logger
  }
}

export {
  buildPluginHelpers
}

// ---------------------------------------------------------------------------

function buildLogger (npmName: string) {
  return buildLogger(npmName)
}
