import { Hooks } from '../plugins/hooks.js'

export function getContextFilter <T> () {
  return (contextData: T) => {
    return Hooks.wrapObject(
      contextData,
      'filter:activity-pub.activity.context.build.result'
    )
  }
}
