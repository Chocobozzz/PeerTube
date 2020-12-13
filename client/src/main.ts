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
    if ('serviceWorker' in navigator && environment.production) {
      navigator.serviceWorker.register('/ngsw-worker.js')
        .catch(err => console.error('Cannot register service worker.', err))
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
