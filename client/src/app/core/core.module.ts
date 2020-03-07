import { CommonModule } from '@angular/common'
import { NgModule, Optional, SkipSelf } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { RouterModule } from '@angular/router'
import { LoadingBarModule } from '@ngx-loading-bar/core'
import { LoadingBarHttpClientModule } from '@ngx-loading-bar/http-client'
import { LoadingBarRouterModule } from '@ngx-loading-bar/router'

import { AuthService } from './auth'
import { ConfirmService } from './confirm'
import { throwIfAlreadyLoaded } from './module-import-guard'
import { LoginGuard, RedirectService, UserRightGuard } from './routing'
import { ServerService } from './server'
import { ThemeService } from './theme'
import { MenuService } from './menu'
import { HotkeyModule } from 'angular2-hotkeys'
import { CheatSheetComponent } from './hotkeys'
import { ToastModule } from 'primeng/toast'
import { Notifier } from './notification'
import { MessageService } from 'primeng/api'
import { UserNotificationSocket } from '@app/core/notification/user-notification-socket.service'
import { ServerConfigResolver } from './routing/server-config-resolver.service'
import { UnloggedGuard } from '@app/core/routing/unlogged-guard.service'
import { PluginService } from '@app/core/plugins/plugin.service'
import { HooksService } from '@app/core/plugins/hooks.service'

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    BrowserAnimationsModule,

    LoadingBarHttpClientModule,
    LoadingBarRouterModule,
    LoadingBarModule,
    ToastModule,

    HotkeyModule.forRoot({
      cheatSheetCloseEsc: true
    })
  ],

  declarations: [
    CheatSheetComponent
  ],

  exports: [
    LoadingBarHttpClientModule,
    LoadingBarModule,

    ToastModule,

    CheatSheetComponent
  ],

  providers: [
    AuthService,
    ConfirmService,
    ServerService,
    ThemeService,
    MenuService,
    LoginGuard,
    UserRightGuard,
    UnloggedGuard,

    PluginService,
    HooksService,

    RedirectService,
    Notifier,
    MessageService,
    UserNotificationSocket,
    ServerConfigResolver
  ]
})
export class CoreModule {
  constructor (@Optional() @SkipSelf() parentModule: CoreModule) {
    throwIfAlreadyLoaded(parentModule, 'CoreModule')
  }
}
