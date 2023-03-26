import { ApplicationRef, enableProdMode } from '@angular/core'
import { enableDebugTools } from '@angular/platform-browser'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'
import { AppModule } from './app/app.module'
import { environment } from './environments/environment'
import { logger } from './root-helpers'

if (environment.production) {
  enableProdMode()
}

logger.registerServerSending(environment.apiUrl)

const bootstrap = () => platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .then(bootstrapModule => {
    if (!environment.production) {
      const applicationRef = bootstrapModule.injector.get(ApplicationRef)
      const componentRef = applicationRef.components[0]

      // allows to run `ng.profiler.timeChangeDetection();`
      enableDebugTools(componentRef)
    }

    return bootstrapModule
  })
  .catch(err => {
    try {
      logger.error(err)
    } catch (err2) {
      console.error('Cannot log error', { err, err2 })
    }

    // Ensure we display an "incompatible message" on Angular bootstrap error
    setTimeout(() => {
      if (document.querySelector('my-app').innerHTML === '') {
        throw err
      }
    }, 1000)

    return null
  })

bootstrap()
