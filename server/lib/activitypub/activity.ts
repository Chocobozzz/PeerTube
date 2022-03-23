import { signJsonLDObject } from '@server/helpers/peertube-crypto'
import { MActor } from '@server/types/models'
import { ContextType } from '@shared/models'
import { activityPubContextify } from './context'

function buildSignedActivity <T> (byActor: MActor, data: T, contextType?: ContextType) {
  const activity = activityPubContextify(data, contextType)

  return signJsonLDObject(byActor, activity)
}

function getAPId (object: string | { id: string }) {
  if (typeof object === 'string') return object

  return object.id
}

export {
  buildSignedActivity,
  getAPId
}
