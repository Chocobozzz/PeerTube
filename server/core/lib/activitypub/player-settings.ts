import { PlayerSettingsObject } from '@peertube/peertube-models'
import { sanitizeAndCheckPlayerSettingsObject } from '@server/helpers/custom-validators/activitypub/player-settings.js'
import { MChannelDefault, MVideoIdUrl } from '../../types/models/index.js'
import { upsertPlayerSettings } from '../player-settings.js'
import { fetchAPObjectIfNeeded } from './activity.js'
import { checkUrlsSameHost, isLocalUrl } from './url.js'

export async function upsertAPPlayerSettings (options: {
  video: MVideoIdUrl
  channel: MChannelDefault
  settingsObject: PlayerSettingsObject | string
  contextUrl: string
}) {
  const { video, channel, contextUrl } = options

  if (!video && !channel) throw new Error('Video or channel must be specified')

  const settingsObject = await fetchAPObjectIfNeeded<PlayerSettingsObject>(options.settingsObject)

  if (!sanitizeAndCheckPlayerSettingsObject(settingsObject, video ? 'video' : 'channel')) {
    throw new Error(`Player settings ${settingsObject.id} object is not valid`)
  }

  // Federation must never update the player settings of a video/channel we own
  if (isLocalUrl(settingsObject.id)) {
    throw new Error(`Cannot update local player settings ${settingsObject.id} from a remote actor`)
  }

  if (!checkUrlsSameHost(settingsObject.id, contextUrl)) {
    throw new Error(`Player settings ${settingsObject.id} object is not on the same host as context URL ${contextUrl}`)
  }

  const objectUrl = video?.url || channel?.Actor.url
  if (!checkUrlsSameHost(settingsObject.id, objectUrl)) {
    throw new Error(`Player settings ${settingsObject.id} object is not on the same host as context URL ${contextUrl}`)
  }

  await upsertPlayerSettings({ user: null, settings: getPlayerSettingsAttributesFromObject(settingsObject), channel, video })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function getPlayerSettingsAttributesFromObject (settingsObject: PlayerSettingsObject) {
  return {
    theme: settingsObject.theme
  }
}
