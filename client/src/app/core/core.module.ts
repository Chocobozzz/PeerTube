import { NgModule, Optional, SkipSelf } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterModule } from '@angular/router'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { LoadingBarModule } from '@ngx-loading-bar/core'
import { LoadingBarHttpClientModule } from '@ngx-loading-bar/http-client'

import { SimpleNotificationsModule } from 'angular2-notifications'
import { ModalModule } from 'ngx-bootstrap/modal'

import { AuthService } from './auth'
import { LoginGuard, UserRightGuard } from './routing'
import { ServerService } from './server'
import { ConfirmComponent, ConfirmService } from './confirm'
import { throwIfAlreadyLoaded } from './module-import-guard'

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    BrowserAnimationsModule,

    ModalModule,
    SimpleNotificationsModule.forRoot(),

    LoadingBarHttpClientModule,
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
    UserRightGuard
  ]
})
export class CoreModule {
  constructor (@Optional() @SkipSelf() parentModule: CoreModule) {
    throwIfAlreadyLoaded(parentModule, 'CoreModule')
  }
}
