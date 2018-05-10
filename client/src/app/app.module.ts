import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { AboutModule } from '@app/about'
import { ServerService } from '@app/core'
import { ResetPasswordModule } from '@app/reset-password'

import { MetaLoader, MetaModule, MetaStaticLoader, PageTitlePositioning } from '@ngx-meta/core'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { CoreModule } from './core'
import { HeaderComponent } from './header'
import { LoginModule } from './login'
import { MenuComponent } from './menu'
import { SharedModule } from './shared'
import { SignupModule } from './signup'
import { VideosModule } from './videos'

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

    CoreModule,
    SharedModule,

    AppRoutingModule,

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
    })
  ],
  providers: [ ]
})
export class AppModule {}
