import { LOCALE_ID, NgModule, TRANSLATIONS, TRANSLATIONS_FORMAT } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { AboutModule } from '@app/about'
import { ServerService } from '@app/core'
import { ResetPasswordModule } from '@app/reset-password'

import { MetaLoader, MetaModule, MetaStaticLoader, PageTitlePositioning } from '@ngx-meta/core'
import { ClipboardModule } from 'ngx-clipboard'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { CoreModule } from './core'
import { HeaderComponent } from './header'
import { LoginModule } from './login'
import { MenuComponent } from './menu'
import { SharedModule } from './shared'
import { SignupModule } from './signup'
import { VideosModule } from './videos'
import { buildFileLocale, getDefaultLocale } from '../../../shared/models/i18n'
import { environment } from '../environments/environment'

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
    HeaderComponent
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
    SignupModule,
    SharedModule,
    VideosModule,
    AboutModule,

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
      useFactory: (locale) => {
        // On dev mode, test locales
        if (environment.production === false && window.location.search === '?lang=fr') {
          return require(`raw-loader!../locale/target/messages_fr.xml`)
        }

        const fileLocale = buildFileLocale(locale)

        // Default locale, nothing to translate
        const defaultFileLocale = buildFileLocale(getDefaultLocale())
        if (fileLocale === defaultFileLocale) return ''

        return require(`raw-loader!../locale/target/messages_${fileLocale}.xml`)
      },
      deps: [ LOCALE_ID ]
    },
    { provide: TRANSLATIONS_FORMAT, useValue: 'xlf' }
  ]
})
export class AppModule {}
