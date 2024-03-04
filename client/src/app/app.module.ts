import 'focus-visible'
import { tap } from 'rxjs/operators'
import { environment } from 'src/environments/environment'
import { APP_BASE_HREF, registerLocaleData } from '@angular/common'
import { APP_INITIALIZER, NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { ServiceWorkerModule } from '@angular/service-worker'
import localeOc from '@app/helpers/locales/oc'
import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { CoreModule, PluginService, RedirectService, ServerService } from './core'
import { EmptyComponent } from './empty.component'
import { HeaderComponent, SearchTypeaheadComponent, SuggestionComponent } from './header'
import { HighlightPipe } from './header/highlight.pipe'
import { polyfillICU } from './helpers'
import { MenuComponent } from './menu'
import { ConfirmComponent } from './modal/confirm.component'
import { CustomModalComponent } from './modal/custom-modal.component'
import { SharedActorImageModule } from './shared/shared-actor-image/shared-actor-image.module'
import { SharedFormModule } from './shared/shared-forms'
import { SharedGlobalIconModule } from './shared/shared-icons'
import { SharedInstanceModule } from './shared/shared-instance'
import { SharedMainModule } from './shared/shared-main'
import { SharedUserInterfaceSettingsModule } from './shared/shared-user-settings'
import { HotkeysCheatSheetComponent } from './hotkeys'
import { InstanceConfigWarningModalComponent } from './modal/instance-config-warning-modal.component'
import { AdminWelcomeModalComponent } from './modal/admin-welcome-modal.component'
import { AccountSetupWarningModalComponent } from './modal/account-setup-warning-modal.component'

registerLocaleData(localeOc, 'oc')

export function loadConfigFactory (server: ServerService, pluginService: PluginService, redirectService: RedirectService) {
  const initializeServices = () => {
    redirectService.init()
    pluginService.initializePlugins()
  }

  return () => {
    const result = server.loadHTMLConfig()
    if (result) return result.pipe(tap(() => initializeServices()))

    initializeServices()
  }
}

@NgModule({
  bootstrap: [ AppComponent ],

  declarations: [
    AppComponent,
    EmptyComponent,

    HeaderComponent,
    SearchTypeaheadComponent,
    SuggestionComponent,
    HighlightPipe,

    CustomModalComponent,
    ConfirmComponent,

    HotkeysCheatSheetComponent
  ],

  imports: [
    BrowserModule,
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production }),

    CoreModule,
    SharedMainModule,
    SharedFormModule,
    SharedUserInterfaceSettingsModule,
    SharedGlobalIconModule,
    SharedInstanceModule,
    SharedActorImageModule,

    MenuComponent,

    InstanceConfigWarningModalComponent,
    AdminWelcomeModalComponent,
    AccountSetupWarningModalComponent,

    AppRoutingModule // Put it after all the module because it has the 404 route
  ],

  providers: [
    {
      provide: APP_BASE_HREF,
      useValue: '/'
    },
    {
      provide: APP_INITIALIZER,
      useFactory: loadConfigFactory,
      deps: [ ServerService, PluginService, RedirectService ],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => polyfillICU,
      multi: true
    }
  ]
})
export class AppModule {}
