import { AutoMuteAction, AutoMuteList } from '@peertube/peertube-models'
import { doJSONRequest } from '@server/helpers/requests.js'

export async function fetchAndValidateAutoMuteList (url: string, startDate?: Date): Promise<AutoMuteList> {
  const searchParams = startDate
    ? { startDate: startDate.toISOString() }
    : undefined

  const { body } = await doJSONRequest<AutoMuteList>(url, { searchParams, preventSSRF: false })

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid auto mute list payload: expected an object')
  }

  const name = body.name
  const rawActions = body.actions

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Invalid auto mute list payload: name must be a non-empty string')
  }

  if (!Array.isArray(rawActions)) {
    throw new Error('Invalid auto mute list payload: actions must be an array')
  }

  const maxActions = 10_000
  if (rawActions.length > maxActions) {
    throw new Error(`Invalid auto mute list payload: actions length must not exceed ${maxActions}`)
  }

  const actions: AutoMuteAction[] = rawActions.map((action, index) => validateAutoMuteAction(action, index))

  return {
    name,
    actions
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function validateAutoMuteAction (action: AutoMuteList['actions'][number], index: number): AutoMuteAction {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new Error(`Invalid auto mute list action at index ${index}: expected object`)
  }

  const type = action.type
  const target = action.target
  const createdAt = action.createdAt

  if (type !== 'block' && type !== 'unblock') {
    throw new Error(`Invalid auto mute list action at index ${index}: type must be block/unblock`)
  }

  if (typeof target !== 'string' || target.trim().length === 0) {
    throw new Error(`Invalid auto mute list action at index ${index}: target must be a non-empty string`)
  }

  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    throw new Error(`Invalid auto mute list action at index ${index}: createdAt must be a valid ISO date`)
  }

  return {
    type,
    target,
    createdAt
  }
}
