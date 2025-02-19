import { from, Observable } from 'rxjs'
import { mergeMap, switchMap } from 'rxjs/operators'
import { Injectable, inject } from '@angular/core'
import { PluginService } from '@app/core/plugins/plugin.service'
import { logger } from '@root-helpers/logger'
import { ClientActionHookName, ClientFilterHookName, PluginClientScope } from '@peertube/peertube-models'
import { AuthService, AuthStatus } from '../auth'

type RawFunction<U, T> = (params: U) => T
type ObservableFunction<U, T> = RawFunction<U, Observable<T>>

@Injectable()
export class HooksService {
  private authService = inject(AuthService)
  private pluginService = inject(PluginService)

  constructor () {
    // Run auth hooks
    this.authService.userInformationLoaded
      .subscribe(() => this.runAction('action:auth-user.information-loaded', 'common', { user: this.authService.getUser() }))

    this.authService.loginChangedSource.subscribe(obj => {
      if (obj === AuthStatus.LoggedIn) {
        this.runAction('action:auth-user.logged-in', 'common')
      } else if (obj === AuthStatus.LoggedOut) {
        this.runAction('action:auth-user.logged-out', 'common')
      }
    })
  }

  wrapObsFun<P, R, H1 extends ClientFilterHookName, H2 extends ClientFilterHookName> (
    fun: ObservableFunction<P, R>,
    params: P,
    scope: PluginClientScope,
    hookParamName: H1,
    hookResultName: H2
  ) {
    return from(this.pluginService.ensurePluginsAreLoaded(scope))
      .pipe(
        mergeMap(() => this.wrapObjectWithoutScopeLoad(params, hookParamName)),
        switchMap(params => fun(params)),
        mergeMap(result => this.pluginService.runHook(hookResultName, result, params))
      )
  }

  async wrapFun<P, R, H1 extends ClientFilterHookName, H2 extends ClientFilterHookName> (
    fun: RawFunction<P, R>,
    params: P,
    scope: PluginClientScope,
    hookParamName: H1,
    hookResultName: H2
  ) {
    await this.pluginService.ensurePluginsAreLoaded(scope)

    const newParams = await this.wrapObjectWithoutScopeLoad(params, hookParamName)
    const result = fun(newParams)

    return this.pluginService.runHook(hookResultName, result, params)
  }

  runAction<T, U extends ClientActionHookName> (hookName: U, scope: PluginClientScope, params?: T) {
    // Use setTimeout to give priority to Angular change detector
    setTimeout(() => {
      this.pluginService.ensurePluginsAreLoaded(scope)
        .then(() => this.pluginService.runHook(hookName, undefined, params))
        .catch((err: any) => logger.error('Fatal hook error.', err))
    })
  }

  async wrapObject<T, U extends ClientFilterHookName> (result: T, scope: PluginClientScope, hookName: U, context?: any) {
    await this.pluginService.ensurePluginsAreLoaded(scope)

    return this.wrapObjectWithoutScopeLoad(result, hookName, context)
  }

  private wrapObjectWithoutScopeLoad<T, U extends ClientFilterHookName> (result: T, hookName: U, context?: any) {
    return this.pluginService.runHook(hookName, result, context)
  }
}
