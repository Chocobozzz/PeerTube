import { WatchedWordsSubscriptionAction, WatchedWordsSubscriptionActions } from '@peertube/peertube-models'
import { doJSONRequest } from '@server/helpers/requests.js'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'

export async function fetchAndValidateWatchedWordsSubscriptionActions (
  url: string,
  startDate?: Date
): Promise<WatchedWordsSubscriptionActions> {
  const searchParams = startDate
    ? { startDate: startDate.toISOString() }
    : undefined

  const { body } = await doJSONRequest<WatchedWordsSubscriptionActions>(url, { searchParams })

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid watched words subscription payload: expected an object')
  }

  const name = body.name
  const rawActions = body.actions

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Invalid watched words subscription payload: name must be a non-empty string')
  }

  if (!Array.isArray(rawActions)) {
    throw new Error('Invalid watched words subscription payload: actions must be an array')
  }

  const maxActions = CONSTRAINTS_FIELDS.WATCHED_WORDS.WORDS.max * 5
  if (rawActions.length > maxActions) {
    throw new Error(
      `Invalid watched words subscription payload: actions length must not exceed ${maxActions}`
    )
  }

  const actions = rawActions.map((action, index) => validateWatchedWordsSubscriptionAction(action, index))

  return {
    name,
    actions
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function validateWatchedWordsSubscriptionAction (
  action: WatchedWordsSubscriptionActions['actions'][number],
  index: number
): WatchedWordsSubscriptionAction {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new Error(`Invalid watched words subscription action at index ${index}: expected object`)
  }

  const { type, word, createdAt } = action

  if (type !== 'add' && type !== 'remove') {
    throw new Error(`Invalid watched words subscription action at index ${index}: type must be add/remove`)
  }

  if (typeof word !== 'string' || word.trim().length === 0) {
    throw new Error(`Invalid watched words subscription action at index ${index}: word must be a non-empty string`)
  }

  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    throw new Error(`Invalid watched words subscription action at index ${index}: createdAt must be a valid ISO date`)
  }

  return {
    type,
    word,
    createdAt
  }
}
