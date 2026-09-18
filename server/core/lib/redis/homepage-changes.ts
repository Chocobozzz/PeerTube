import { publishToRedis, subscribeToRedis } from './redis-client.js'

const HOMEPAGE_CHANGES_CHANNEL = 'homepage-changes'

// No payload: processes reload the homepage from the database, so concurrent updates cannot be applied out of order
export function publishHomepageChanged () {
  return publishToRedis(HOMEPAGE_CHANGES_CHANNEL, '')
}

export function subscribeToHomepageChanges (handler: () => void) {
  return subscribeToRedis(HOMEPAGE_CHANGES_CHANNEL, () => handler())
}
