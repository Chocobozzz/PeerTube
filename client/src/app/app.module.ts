import { ApplicationRef, NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import {
  removeNgStyles,
  createNewHosts,
  createInputTransfer
} from '@angularclass/hmr'

import { MetaModule, MetaLoader, MetaStaticLoader, PageTitlePositioning } from '@ngx-meta/core'
import 'bootstrap-loader'

import { ENV_PROVIDERS } from './environment'
import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { AppState, InternalStateType } from './app.service'

import { AccountModule } from './account'
import { CoreModule } from './core'
import { LoginModule } from './login'
import { SignupModule } from './signup'
import { SharedModule } from './shared'
import { VideosModule } from './videos'

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

type StoreType = {
  state: InternalStateType,
  restoreInputValues: () => void,
  disposeOldHosts: () => void
}

// Application wide providers
const APP_PROVIDERS = [
  AppState
]

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
  constructor (
    public appRef: ApplicationRef,
    public appState: AppState
  ) {}

  public hmrOnInit (store: StoreType) {
    if (!store || !store.state) {
      return
    }
    console.log('HMR store', JSON.stringify(store, null, 2))
    /**
     * Set state
     */
    this.appState._state = store.state
    /**
     * Set input values
     */
    if ('restoreInputValues' in store) {
      let restoreInputValues = store.restoreInputValues
      setTimeout(restoreInputValues)
    }

    this.appRef.tick()
    delete store.state
    delete store.restoreInputValues
  }

  public hmrOnDestroy (store: StoreType) {
    const cmpLocation = this.appRef.components.map((cmp) => cmp.location.nativeElement)
    /**
     * Save state
     */
    const state = this.appState._state
    store.state = state
    /**
     * Recreate root elements
     */
    store.disposeOldHosts = createNewHosts(cmpLocation)
    /**
     * Save input values
     */
    store.restoreInputValues = createInputTransfer()
    /**
     * Remove styles
     */
    removeNgStyles()
  }

  public hmrAfterDestroy (store: StoreType) {
    /**
     * Display new elements
     */
    store.disposeOldHosts()
    delete store.disposeOldHosts
  }
}
