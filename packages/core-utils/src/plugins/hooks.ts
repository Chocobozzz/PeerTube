import { HookType, HookType_Type, RegisteredExternalAuthConfig } from '@peertube/peertube-models'
import { isCatchable, isPromise } from '../common/promises.js'

function getHookType (hookName: string) {
  if (hookName.startsWith('filter:')) return HookType.FILTER
  if (hookName.startsWith('action:')) return HookType.ACTION

  return HookType.STATIC
}

async function internalRunHook <T> (options: {
  handler: Function
  hookType: HookType_Type
  result: T
  params: any
  onError: (err: Error) => void
}) {
  const { handler, hookType, result, params, onError } = options

  try {
    if (hookType === HookType.FILTER) {
      const p = handler(result, params)

      const newResult = isPromise(p)
        ? await p
        : p

      return newResult
    }

    // Action/static hooks do not have result value
    const p = handler(params)

    if (hookType === HookType.STATIC) {
      if (isPromise(p)) await p

      return undefined
    }

    if (hookType === HookType.ACTION) {
      if (isCatchable(p)) p.catch((err: any) => onError(err))

      return undefined
    }
  } catch (err) {
    onError(err)
  }

  return result
}

function getExternalAuthHref (apiUrl: string, auth: RegisteredExternalAuthConfig) {
  return apiUrl + `/plugins/${auth.name}/${auth.version}/auth/${auth.authName}`
}

export {
  getHookType,
  internalRunHook,
  getExternalAuthHref
}
