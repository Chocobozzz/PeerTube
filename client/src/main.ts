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
    logger.error(err)
    return null
  })

bootstrap()
