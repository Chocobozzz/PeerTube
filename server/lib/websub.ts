import { logger } from '../helpers/logger'
import { doRequest } from '../helpers/requests'
import { CONFIG } from '../initializers/constants'

async function publishToWebSubHubs (ressources: string[]) {
  logger.info('Publishing ressources to WebSub hubs.')

  CONFIG.SERVICES.WEBSUB.HUBS.forEach(hub => {
    ressources.forEach(async url => {
      const options = {
        method: 'POST',
        uri: hub,
        activityPub: false,
        form: {
          hub: {
            mode: 'publish',
            url
          }
        }
      }

      try {
        await doRequest(options)
      } catch (err) {
        throw err
      }
    })
  })
}

  // ---------------------------------------------------------------------------

export {
  publishToWebSubHubs
}
