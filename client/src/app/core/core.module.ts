import { HotkeyModule } from 'angular2-hotkeys'
import { MessageService } from 'primeng/api'
import { ToastModule } from 'primeng/toast'
import { CommonModule } from '@angular/common'
import { NgModule, Optional, SkipSelf } from '@angular/core'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { UserNotificationSocket } from '@app/core/notification/user-notification-socket.service'
import { HooksService } from '@app/core/plugins/hooks.service'
import { PluginService } from '@app/core/plugins/plugin.service'
import { UnloggedGuard } from '@app/core/routing/unlogged-guard.service'
import { LoadingBarModule } from '@ngx-loading-bar/core'
import { LoadingBarHttpClientModule } from '@ngx-loading-bar/http-client'
import { LoadingBarRouterModule } from '@ngx-loading-bar/router'
import { AuthService } from './auth'
import { ConfirmService } from './confirm'
import { CheatSheetComponent } from './hotkeys'
import { MenuService } from './menu'
import { throwIfAlreadyLoaded } from './module-import-guard'
import { Notifier } from './notification'
import { HtmlRendererService, LinkifierService, MarkdownService } from './renderer'
import { RestExtractor, RestService } from './rest'
import { LoginGuard, RedirectService, UserRightGuard } from './routing'
import { CanDeactivateGuard } from './routing/can-deactivate-guard.service'
import { ServerConfigResolver } from './routing/server-config-resolver.service'
import { ServerService } from './server'
import { ThemeService } from './theme'
import { UserService } from './users'
import { LocalStorageService, ScreenService, SessionStorageService } from './wrappers'

@NgModule({
  imports: [
    CommonModule,
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

    HtmlRendererService,
    LinkifierService,
    MarkdownService,

    RestExtractor,
    RestService,

    UserService,

    ScreenService,
    LocalStorageService,
    SessionStorageService,

    RedirectService,
    Notifier,
    MessageService,
    UserNotificationSocket,
    ServerConfigResolver,
    CanDeactivateGuard
  ]
})
export class CoreModule {
  constructor (@Optional() @SkipSelf() parentModule: CoreModule) {
    throwIfAlreadyLoaded(parentModule, 'CoreModule')
  }
}
