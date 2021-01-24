import 'focus-visible'
import { environment } from 'src/environments/environment'
import { APP_BASE_HREF, registerLocaleData } from '@angular/common'
import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { ServiceWorkerModule } from '@angular/service-worker'
import { ServerService } from '@app/core'
import localeOc from '@app/helpers/locales/oc'
import { MetaLoader, MetaModule, MetaStaticLoader, PageTitlePositioning } from '@ngx-meta/core'
import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { CoreModule } from './core'
import { EmptyComponent } from './empty.component'
import { HeaderComponent, SearchTypeaheadComponent, SuggestionComponent } from './header'
import { HighlightPipe } from './header/highlight.pipe'
import { LanguageChooserComponent, MenuComponent, NotificationComponent } from './menu'
import { ConfirmComponent } from './modal/confirm.component'
import { CustomModalComponent } from './modal/custom-modal.component'
import { InstanceConfigWarningModalComponent } from './modal/instance-config-warning-modal.component'
import { QuickSettingsModalComponent } from './modal/quick-settings-modal.component'
import { WelcomeModalComponent } from './modal/welcome-modal.component'
import { SharedFormModule } from './shared/shared-forms'
import { SharedGlobalIconModule } from './shared/shared-icons'
import { SharedInstanceModule } from './shared/shared-instance'
import { SharedMainModule } from './shared/shared-main'
import { SharedUserInterfaceSettingsModule } from './shared/shared-user-settings'

registerLocaleData(localeOc, 'oc')

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

    MetaModule.forRoot({
      provide: MetaLoader,
      useFactory: (serverService: ServerService) => {
        return new MetaStaticLoader({
          pageTitlePositioning: PageTitlePositioning.PrependPageTitle,
          pageTitleSeparator: ' - ',
          get applicationName () { return serverService.getTmpConfig().instance.name },
          defaults: {
            get title () { return serverService.getTmpConfig().instance.name },
            get description () { return serverService.getTmpConfig().instance.shortDescription }
          }
        })
      },
      deps: [ ServerService ]
    }),

    AppRoutingModule // Put it after all the module because it has the 404 route
  ],

  providers: [
    {
      provide: APP_BASE_HREF,
      useValue: '/'
    }
  ]
})
export class AppModule {}
