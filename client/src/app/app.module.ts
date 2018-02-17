import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { ServiceWorkerModule } from '@angular/service-worker'
import { AboutModule } from '@app/about'
import { ResetPasswordModule } from '@app/reset-password'

import { MetaLoader, MetaModule, MetaStaticLoader, PageTitlePositioning } from '@ngx-meta/core'
import { environment } from '../environments/environment'

import { AccountModule } from './account'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { CoreModule } from './core'
import { HeaderComponent } from './header'
import { LoginModule } from './login'
import { MenuComponent } from './menu'
import { SharedModule } from './shared'
import { SignupModule } from './signup'
import { VideosModule } from './videos'

export function metaFactory (): MetaLoader {
  return new MetaStaticLoader({
    pageTitlePositioning: PageTitlePositioning.PrependPageTitle,
    pageTitleSeparator: ' - ',
    applicationName: 'PeerTube',
    defaults: {
      title: 'PeerTube',
      description: 'PeerTube, a federated (ActivityPub) video streaming platform  ' +
                   'using P2P (BitTorrent) directly in the web browser with WebTorrent and Angular. '
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

    AccountModule,
    CoreModule,
    LoginModule,
    ResetPasswordModule,
    SignupModule,
    SharedModule,
    VideosModule,
    AboutModule,

    MetaModule.forRoot({
      provide: MetaLoader,
      useFactory: (metaFactory)
    }),

    ServiceWorkerModule.register('/ngsw-worker.js', { enabled: environment.production })
  ],
  providers: [ ]
})
export class AppModule {}
