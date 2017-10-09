import { NgModule, Optional, SkipSelf } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpModule } from '@angular/http'
import { RouterModule } from '@angular/router'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'

import { SimpleNotificationsModule } from 'angular2-notifications'
import { ModalModule } from 'ngx-bootstrap/modal'

import { AuthService } from './auth'
import { ServerService } from './server'
import { ConfirmComponent, ConfirmService } from './confirm'
import { MenuComponent, MenuAdminComponent } from './menu'
import { throwIfAlreadyLoaded } from './module-import-guard'

@NgModule({
  imports: [
    CommonModule,
    HttpModule,
    RouterModule,
    BrowserAnimationsModule,

    ModalModule,
    SimpleNotificationsModule.forRoot()
  ],

  declarations: [
    ConfirmComponent,
    MenuComponent,
    MenuAdminComponent
  ],

  exports: [
    SimpleNotificationsModule,

    ConfirmComponent,
    MenuComponent,
    MenuAdminComponent
  ],

  providers: [
    AuthService,
    ConfirmService,
    ServerService
  ]
})
export class CoreModule {
  constructor ( @Optional() @SkipSelf() parentModule: CoreModule) {
    throwIfAlreadyLoaded(parentModule, 'CoreModule')
  }
}
