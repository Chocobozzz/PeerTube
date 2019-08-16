import { Injectable } from '@angular/core'
import { PluginService } from '@app/core/plugins/plugin.service'
import { ClientActionHookName, ClientFilterHookName } from '@shared/models/plugins/client-hook.model'
import { from, Observable } from 'rxjs'
import { mergeMap, switchMap } from 'rxjs/operators'
import { ServerService } from '@app/core/server'
import { PluginClientScope } from '@shared/models/plugins/plugin-client-scope.type'

type RawFunction<U, T> = (params: U) => T
type ObservableFunction<U, T> = RawFunction<U, Observable<T>>

@Injectable()
export class HooksService {
  constructor (
    private server: ServerService,
    private pluginService: PluginService
  ) { }

  wrapObject<T, U extends ClientFilterHookName> (result: T, hookName: U) {
    return this.pluginService.runHook(hookName, result)
  }

  wrapObsFun
    <P, R, H1 extends ClientFilterHookName, H2 extends ClientFilterHookName>
    (fun: ObservableFunction<P, R>, params: P, scope: PluginClientScope, hookParamName: H1, hookResultName: H2) {
    return from(this.pluginService.ensurePluginsAreLoaded(scope))
      .pipe(
        mergeMap(() => this.wrapObject(params, hookParamName)),
        switchMap(params => fun(params)),
        mergeMap(result => this.pluginService.runHook(hookResultName, result, params))
      )
  }

  async wrapFun<U, T, V extends ClientFilterHookName> (fun: RawFunction<U, T>, params: U, hookName: V) {
    const result = fun(params)

    return this.pluginService.runHook(hookName, result, params)
  }

  runAction<T, U extends ClientActionHookName> (hookName: U, scope: PluginClientScope, params?: T) {
    this.pluginService.ensurePluginsAreLoaded(scope)
        .then(() => this.pluginService.runHook(hookName, undefined, params))
        .catch((err: any) => console.error('Fatal hook error.', { err }))
  }
}
