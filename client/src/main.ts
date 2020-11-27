import { ApplicationRef, enableProdMode } from '@angular/core'
import { enableDebugTools } from '@angular/platform-browser'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'
import { AppModule } from './app/app.module'
import { environment } from './environments/environment'

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

    if (!environment.production) {
      const applicationRef = bootstrapModule.injector.get(ApplicationRef)
      const componentRef = applicationRef.components[0]

      // allows to run `ng.profiler.timeChangeDetection();`
      enableDebugTools(componentRef)
    }

    return bootstrapModule
  })
  .catch(err => {
    console.error(err)
    return null
  })

bootstrap()
