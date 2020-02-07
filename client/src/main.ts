import { enableProdMode } from '@angular/core'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'

import { AppModule } from './app/app.module'
import { environment } from './environments/environment'

import { hmrBootstrap } from './hmr'

if (environment.production) {
  enableProdMode()
}

const bootstrap = () => platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .then(bootstrapModule => {
    // TODO: Uncomment and remove unregistration when https://github.com/angular/angular/issues/21191 is fixed
    // TODO: Remove when https://github.com/angular/angular-cli/issues/8779 is fixed?
    // if ('serviceWorker' in navigator && environment.production) {
    //   navigator.serviceWorker.register('/ngsw-worker.js')
    //     .catch(err => console.error('Cannot register service worker.', err))
    // }

    if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
      navigator.serviceWorker.getRegistrations()
               .then(registrations => {
                 for (const registration of registrations) {
                   registration.unregister()
                 }
               })
    }

    return bootstrapModule
  })
  .catch(err => {
    console.error(err)
    return null
  })

if (environment.hmr) {
  if (module[ 'hot' ]) {
    hmrBootstrap(module, bootstrap)
  } else {
    console.error('HMR is not enabled for webpack-dev-server!')
    console.log('Are you using the --hmr flag for ng serve?')
  }
} else {
  bootstrap()
}
