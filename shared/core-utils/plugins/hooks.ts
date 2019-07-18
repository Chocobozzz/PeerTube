import { HookType } from '../../models/plugins/hook-type.enum'
import { isCatchable, isPromise } from '../miscs/miscs'

function getHookType (hookName: string) {
  if (hookName.startsWith('filter:')) return HookType.FILTER
  if (hookName.startsWith('action:')) return HookType.ACTION

  return HookType.STATIC
}

async function internalRunHook (handler: Function, hookType: HookType, param: any, onError: (err: Error) => void) {
  let result = param

  try {
    const p = handler(result)

    switch (hookType) {
      case HookType.FILTER:
        if (isPromise(p)) result = await p
        else result = p
        break

      case HookType.STATIC:
        if (isPromise(p)) await p
        break

      case HookType.ACTION:
        if (isCatchable(p)) p.catch(err => onError(err))
        break
    }
  } catch (err) {
    onError(err)
  }

  return result
}

export {
  getHookType,
  internalRunHook
}
