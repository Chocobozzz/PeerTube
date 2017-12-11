import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'

import { MetaModule, MetaLoader, MetaStaticLoader, PageTitlePositioning } from '@ngx-meta/core'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'

import { AccountModule } from './account'
import { CoreModule } from './core'
import { LoginModule } from './login'
import { SignupModule } from './signup'
import { SharedModule } from './shared'
import { VideosModule } from './videos'
import { MenuComponent } from './menu'
import { HeaderComponent } from './header'

export function metaFactory (): MetaLoader {
  return new MetaStaticLoader({
    pageTitlePositioning: PageTitlePositioning.PrependPageTitle,
    pageTitleSeparator: ' - ',
    applicationName: 'PeerTube',
    defaults: {
      title: 'PeerTube',
      description: 'PeerTube, a decentralized video streaming platform using P2P (BitTorrent) directly in the web browser'
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
    SignupModule,
    SharedModule,
    VideosModule,

    MetaModule.forRoot({
      provide: MetaLoader,
      useFactory: (metaFactory)
    })
  ],
  providers: [ ]
})
export class AppModule {}
