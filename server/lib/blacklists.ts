import { logger } from '../helpers'
import { BlacklistedVideoInstance } from '../models'

function removeVideoFromBlacklist (entry: BlacklistedVideoInstance) {
  return entry.destroy()
    .then(() => {
      logger.info('Video removed from the blacklist')
    })
    .catch(err => {
      logger.error('Some error while removing video from the blacklist.', err)
    })
}


// ---------------------------------------------------------------------------

export {
  removeVideoFromBlacklist
}

// ---------------------------------------------------------------------------

