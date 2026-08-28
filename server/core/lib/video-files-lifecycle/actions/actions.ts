import { VideoLifecycleAction, VideoLifecycleActionType } from '@peertube/peertube-models'
import { LifecycleActionHandler } from './action.model.js'
import { deleteResolutionsAction } from './delete-resolutions.js'

const actionHandlers: { [T in VideoLifecycleActionType]: LifecycleActionHandler<any> } = {
  'delete-resolutions': deleteResolutionsAction
}

export function getActionHandler (action: VideoLifecycleAction) {
  // Don't resolve inherited object properties (constructor, toString...)
  if (!action?.type || Object.hasOwn(actionHandlers, action.type) !== true) return undefined

  return actionHandlers[action.type] as LifecycleActionHandler<VideoLifecycleAction>
}

export function getActionTypes () {
  return Object.keys(actionHandlers)
}

export * from './action.model.js'
