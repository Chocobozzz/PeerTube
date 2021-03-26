import { HotkeyModule } from 'angular2-hotkeys'
import { MessageService } from 'primeng/api'
import { ToastModule } from 'primeng/toast'
import { CommonModule } from '@angular/common'
import { NgModule, Optional, SkipSelf } from '@angular/core'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { PeerTubeSocket } from '@app/core/notification/peertube-socket.service'
import { HooksService } from '@app/core/plugins/hooks.service'
import { PluginService } from '@app/core/plugins/plugin.service'
import { AuthService } from './auth'
import { ConfirmService } from './confirm'
import { CheatSheetComponent } from './hotkeys'
import { MenuService } from './menu'
import { throwIfAlreadyLoaded } from './module-import-guard'
import { Notifier } from './notification'
import { HtmlRendererService, LinkifierService, MarkdownService } from './renderer'
import { RestExtractor, RestService } from './rest'
import { LoginGuard, RedirectService, UserRightGuard, UnloggedGuard } from './routing'
import { CanDeactivateGuard } from './routing/can-deactivate-guard.service'
import { ServerConfigResolver } from './routing/server-config-resolver.service'
import { ScopedTokensService } from './scoped-tokens'
import { ServerService } from './server'
import { ThemeService } from './theme'
import { UserService } from './users'
import { LocalStorageService, ScreenService, SessionStorageService } from './wrappers'

@NgModule({
  imports: [
    CommonModule,
    BrowserAnimationsModule,

    ToastModule,

    HotkeyModule.forRoot({
      cheatSheetCloseEsc: true
    })
  ],

  declarations: [
    CheatSheetComponent
  ],

  exports: [
    ToastModule,

    CheatSheetComponent
  ],

  providers: [
    AuthService,
    ScopedTokensService,
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
    PeerTubeSocket,
    ServerConfigResolver,
    CanDeactivateGuard
  ]
})
export class CoreModule {
  constructor (@Optional() @SkipSelf() parentModule: CoreModule) {
    throwIfAlreadyLoaded(parentModule, 'CoreModule')
  }
}
