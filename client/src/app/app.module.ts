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
import { CoreModule, PluginService, ServerService } from './core'
import { EmptyComponent } from './empty.component'
import { HeaderComponent, SearchTypeaheadComponent, SuggestionComponent } from './header'
import { HighlightPipe } from './header/highlight.pipe'
import { LanguageChooserComponent, MenuComponent, NotificationComponent } from './menu'
import { ConfirmComponent } from './modal/confirm.component'
import { CustomModalComponent } from './modal/custom-modal.component'
import { InstanceConfigWarningModalComponent } from './modal/instance-config-warning-modal.component'
import { QuickSettingsModalComponent } from './modal/quick-settings-modal.component'
import { WelcomeModalComponent } from './modal/welcome-modal.component'
import { SharedActorImageModule } from './shared/shared-actor-image/shared-actor-image.module'
import { SharedFormModule } from './shared/shared-forms'
import { SharedGlobalIconModule } from './shared/shared-icons'
import { SharedInstanceModule } from './shared/shared-instance'
import { SharedMainModule } from './shared/shared-main'
import { SharedUserInterfaceSettingsModule } from './shared/shared-user-settings'

registerLocaleData(localeOc, 'oc')

export function loadConfigFactory (server: ServerService, pluginService: PluginService) {
  return () => {
    const result = server.loadHTMLConfig()

    if (result) return result.pipe(tap(() => pluginService.initializePlugins()))

    return pluginService.initializePlugins()
  }
}

@NgModule({
  bootstrap: [ AppComponent ],

  declarations: [
    AppComponent,
    EmptyComponent,

    MenuComponent,
    LanguageChooserComponent,
    QuickSettingsModalComponent,
    NotificationComponent,
    HeaderComponent,
    SearchTypeaheadComponent,
    SuggestionComponent,
    HighlightPipe,

    CustomModalComponent,
    WelcomeModalComponent,
    InstanceConfigWarningModalComponent,
    ConfirmComponent
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
      deps: [ ServerService, PluginService ],
      multi: true
    }
  ]
})
export class AppModule {}
