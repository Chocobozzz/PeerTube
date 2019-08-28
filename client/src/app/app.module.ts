import { LOCALE_ID, NgModule, TRANSLATIONS, TRANSLATIONS_FORMAT } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { ServerService } from '@app/core'
import { ResetPasswordModule } from '@app/reset-password'

import { MetaLoader, MetaModule, MetaStaticLoader, PageTitlePositioning } from '@ngx-meta/core'
import { ClipboardModule } from 'ngx-clipboard'
import 'focus-visible'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { CoreModule } from './core'
import { HeaderComponent } from './header'
import { LoginModule } from './login'
import { AvatarNotificationComponent, LanguageChooserComponent, MenuComponent } from './menu'
import { SharedModule } from './shared'
import { VideosModule } from './videos'
import { buildFileLocale, getCompleteLocale, isDefaultLocale } from '../../../shared/models/i18n'
import { getDevLocale, isOnDevLocale } from '@app/shared/i18n/i18n-utils'
import { SearchModule } from '@app/search'
import { WelcomeModalComponent } from '@app/modal/welcome-modal.component'
import { InstanceConfigWarningModalComponent } from '@app/modal/instance-config-warning-modal.component'

export function metaFactory (serverService: ServerService): MetaLoader {
  return new MetaStaticLoader({
    pageTitlePositioning: PageTitlePositioning.PrependPageTitle,
    pageTitleSeparator: ' - ',
    get applicationName () { return serverService.getConfig().instance.name },
    defaults: {
      get title () { return serverService.getConfig().instance.name },
      get description () { return serverService.getConfig().instance.shortDescription }
    }
  })
}

@NgModule({
  bootstrap: [ AppComponent ],
  declarations: [
    AppComponent,

    MenuComponent,
    LanguageChooserComponent,
    AvatarNotificationComponent,
    HeaderComponent,

    WelcomeModalComponent,
    InstanceConfigWarningModalComponent
  ],
  imports: [
    BrowserModule,
    // FIXME: https://github.com/maxisam/ngx-clipboard/issues/133
    ClipboardModule,

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
      provide: TRANSLATIONS,
      useFactory: (locale: string) => {
        // On dev mode, test localization
        if (isOnDevLocale()) {
          locale = buildFileLocale(getDevLocale())
          return require(`raw-loader!../locale/target/angular_${locale}.xml`)
        }

        // Default locale, nothing to translate
        const completeLocale = getCompleteLocale(locale)
        if (isDefaultLocale(completeLocale)) return ''

        const fileLocale = buildFileLocale(locale)
        return require(`raw-loader!../locale/target/angular_${fileLocale}.xml`)
      },
      deps: [ LOCALE_ID ]
    },
    { provide: TRANSLATIONS_FORMAT, useValue: 'xlf' }
  ]
})
export class AppModule {}
