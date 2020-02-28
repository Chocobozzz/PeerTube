import { LOCALE_ID, NgModule, TRANSLATIONS, TRANSLATIONS_FORMAT } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { ServerService } from '@app/core'
import { ResetPasswordModule } from '@app/reset-password'

import { MetaLoader, MetaModule, MetaStaticLoader, PageTitlePositioning } from '@ngx-meta/core'
import 'focus-visible'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { CoreModule } from './core'
import { HeaderComponent, SearchTypeaheadComponent, SuggestionsComponent, SuggestionComponent } from './header'
import { LoginModule } from './login'
import { AvatarNotificationComponent, LanguageChooserComponent, MenuComponent } from './menu'
import { SharedModule } from './shared'
import { VideosModule } from './videos'
import { SearchModule } from '@app/search'
import { WelcomeModalComponent } from '@app/modal/welcome-modal.component'
import { InstanceConfigWarningModalComponent } from '@app/modal/instance-config-warning-modal.component'
import { buildFileLocale, getCompleteLocale, isDefaultLocale } from '@shared/models'
import { APP_BASE_HREF } from '@angular/common'
import { QuickSettingsModalComponent } from '@app/modal/quick-settings-modal.component'

export function metaFactory (serverService: ServerService): MetaLoader {
  return new MetaStaticLoader({
    pageTitlePositioning: PageTitlePositioning.PrependPageTitle,
    pageTitleSeparator: ' - ',
    get applicationName () { return serverService.getTmpConfig().instance.name },
    defaults: {
      get title () { return serverService.getTmpConfig().instance.name },
      get description () { return serverService.getTmpConfig().instance.shortDescription }
    }
  })
}

@NgModule({
  bootstrap: [ AppComponent ],
  declarations: [
    AppComponent,

    MenuComponent,
    LanguageChooserComponent,
    QuickSettingsModalComponent,
    AvatarNotificationComponent,
    HeaderComponent,
    SearchTypeaheadComponent,
    SuggestionsComponent,
    SuggestionComponent,

    WelcomeModalComponent,
    InstanceConfigWarningModalComponent
  ],
  imports: [
    BrowserModule,

    CoreModule,
    SharedModule,

    CoreModule,
    LoginModule,
    ResetPasswordModule,
    SearchModule,
    SharedModule,
    VideosModule,

    MetaModule.forRoot({
      provide: MetaLoader,
      useFactory: (metaFactory),
      deps: [ ServerService ]
    }),

    AppRoutingModule // Put it after all the module because it has the 404 route
  ],

  providers: [
    {
      provide: APP_BASE_HREF,
      useValue: '/'
    },

    {
      provide: TRANSLATIONS,
      useFactory: (locale: string) => {
                // Default locale, nothing to translate
        const completeLocale = getCompleteLocale(locale)
        if (isDefaultLocale(completeLocale)) return ''

        const fileLocale = buildFileLocale(locale)
        return require(`raw-loader!../locale/angular.${fileLocale}.xlf`)
      },
      deps: [ LOCALE_ID ]
    },
    { provide: TRANSLATIONS_FORMAT, useValue: 'xlf' }
  ]
})
export class AppModule {}
