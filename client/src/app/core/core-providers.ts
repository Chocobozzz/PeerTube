import { MessageService } from 'primeng/api'
import { PeerTubeSocket } from '@app/core/notification/peertube-socket.service'
import { HooksService, PluginService } from '@app/core/plugins'
import { AuthService } from './auth'
import { ConfirmService } from './confirm'
import { MenuService } from './menu'
import { Notifier } from './notification'
import { HtmlRendererService, LinkifierService, MarkdownService } from './renderer'
import { RestExtractor, RestService } from './rest'
import {
  LoginGuard,
  MetaGuard,
  MetaService,
  PeerTubeRouterService,
  RedirectService,
  ScrollService,
  UnloggedGuard,
  UserRightGuard
} from './routing'
import { CanDeactivateGuard } from './routing/can-deactivate-guard.service'
import { ServerConfigResolver } from './routing/server-config-resolver.service'
import { ScopedTokensService } from './scoped-tokens'
import { ServerService } from './server'
import { ThemeService } from './theme'
import { UserLocalStorageService, UserService } from './users'
import { LocalStorageService, ScreenService, SessionStorageService } from './wrappers'
import { HotkeysService } from './hotkeys'

export function getCoreProviders () {
  return [
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
    UserLocalStorageService,
    ScreenService,
    LocalStorageService,
    SessionStorageService,
    RedirectService,
    Notifier,
    MessageService,
    PeerTubeSocket,
    ServerConfigResolver,
    CanDeactivateGuard,
    PeerTubeRouterService,
    ScrollService,
    MetaService,
    MetaGuard,
    HotkeysService
  ]
}
