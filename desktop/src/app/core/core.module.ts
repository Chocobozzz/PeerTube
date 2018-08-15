import { CommonModule } from '@angular/common'
import { NgModule, Optional, SkipSelf } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { RouterModule } from '@angular/router'
import { LoadingBarModule } from '@ngx-loading-bar/core'
import { LoadingBarHttpClientModule } from '@ngx-loading-bar/http-client'
import { LoadingBarRouterModule } from '@ngx-loading-bar/router'

import { SimpleNotificationsModule } from 'angular2-notifications'

import { AuthService } from './auth'
import { ConfirmComponent, ConfirmService } from './confirm'
import { throwIfAlreadyLoaded } from './module-import-guard'
import { LoginGuard, RedirectService, UserRightGuard } from './routing'
import { ServerService } from './server'

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    BrowserAnimationsModule,

    SimpleNotificationsModule.forRoot(),

    LoadingBarHttpClientModule,
    LoadingBarRouterModule,
    LoadingBarModule.forRoot()
  ],

  declarations: [
    ConfirmComponent
  ],

  exports: [
    SimpleNotificationsModule,
    LoadingBarHttpClientModule,
    LoadingBarModule,

    ConfirmComponent
  ],

  providers: [
    AuthService,
    ConfirmService,
    ServerService,
    LoginGuard,
    UserRightGuard,
    RedirectService
  ]
})
export class CoreModule {
  constructor (@Optional() @SkipSelf() parentModule: CoreModule) {
    throwIfAlreadyLoaded(parentModule, 'CoreModule')
  }
}
