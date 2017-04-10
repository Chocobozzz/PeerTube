import { ApplicationRef, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { removeNgStyles, createNewHosts } from '@angularclass/hmr';

import { MetaModule, MetaLoader, MetaStaticLoader, PageTitlePositioning } from '@nglibs/meta';
import 'bootstrap-loader';

import { ENV_PROVIDERS } from './environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AppState } from './app.service';

import { AccountModule } from './account';
import { CoreModule } from './core';
import { LoginModule } from './login';
import { SignupModule } from './signup';
import { SharedModule } from './shared';
import { VideosModule } from './videos';

export function metaFactory(): MetaLoader {
  return new MetaStaticLoader({
    pageTitlePositioning: PageTitlePositioning.PrependPageTitle,
    pageTitleSeparator: ' - ',
    applicationName: 'PeerTube',
    defaults: {
      title: 'PeerTube',
      description: 'PeerTube, a decentralized video streaming platform using P2P (BitTorrent) directly in the web browser'
    }
  });
}

// Application wide providers
const APP_PROVIDERS = [
  AppState
];

@NgModule({
  bootstrap: [ AppComponent ],
  declarations: [
    AppComponent
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
  providers: [ // expose our Services and Providers into Angular's dependency injection
    ENV_PROVIDERS,
    APP_PROVIDERS
  ]
})
export class AppModule {
  constructor(public appRef: ApplicationRef, public appState: AppState) {}
  hmrOnInit(store) {
    if (!store || !store.state) return;
    console.log('HMR store', store);
    this.appState._state = store.state;
    this.appRef.tick();
    delete store.state;
  }
  hmrOnDestroy(store) {
    const cmpLocation = this.appRef.components.map(cmp => cmp.location.nativeElement);
    // recreate elements
    const state = this.appState._state;
    store.state = state;
    store.disposeOldHosts = createNewHosts(cmpLocation);
    // remove styles
    removeNgStyles();
  }
  hmrAfterDestroy(store) {
    // display new elements
    store.disposeOldHosts();
    delete store.disposeOldHosts;
  }
}
