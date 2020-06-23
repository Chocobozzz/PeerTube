import { from, Observable } from 'rxjs'
import { mergeMap, switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { PluginService } from '@app/core/plugins/plugin.service'
import { ClientActionHookName, ClientFilterHookName, PluginClientScope } from '@shared/models'

type RawFunction<U, T> = (params: U) => T
type ObservableFunction<U, T> = RawFunction<U, Observable<T>>

@Injectable()
export class HooksService {
  constructor (private pluginService: PluginService) { }

  wrapObsFun
    <P, R, H1 extends ClientFilterHookName, H2 extends ClientFilterHookName>
    (fun: ObservableFunction<P, R>, params: P, scope: PluginClientScope, hookParamName: H1, hookResultName: H2) {
    return from(this.pluginService.ensurePluginsAreLoaded(scope))
      .pipe(
        mergeMap(() => this.wrapObjectWithoutScopeLoad(params, hookParamName)),
        switchMap(params => fun(params)),
        mergeMap(result => this.pluginService.runHook(hookResultName, result, params))
      )
  }

  async wrapFun
    <P, R, H1 extends ClientFilterHookName, H2 extends ClientFilterHookName>
    (fun: RawFunction<P, R>, params: P, scope: PluginClientScope, hookParamName: H1, hookResultName: H2) {
    await this.pluginService.ensurePluginsAreLoaded(scope)

    const newParams = await this.wrapObjectWithoutScopeLoad(params, hookParamName)
    const result = fun(newParams)

    return this.pluginService.runHook(hookResultName, result, params)
  }

  runAction<T, U extends ClientActionHookName> (hookName: U, scope: PluginClientScope, params?: T) {
    this.pluginService.ensurePluginsAreLoaded(scope)
        .then(() => this.pluginService.runHook(hookName, undefined, params))
        .catch((err: any) => console.error('Fatal hook error.', { err }))
  }

  async wrapObject<T, U extends ClientFilterHookName> (result: T, scope: PluginClientScope, hookName: U) {
    await this.pluginService.ensurePluginsAreLoaded(scope)

    return this.wrapObjectWithoutScopeLoad(result, hookName)
  }

  private wrapObjectWithoutScopeLoad<T, U extends ClientFilterHookName> (result: T, hookName: U) {
    return this.pluginService.runHook(hookName, result)
  }
}
