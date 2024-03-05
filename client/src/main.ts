import { ApplicationRef, enableProdMode, APP_INITIALIZER, importProvidersFrom } from '@angular/core'
import { enableDebugTools, BrowserModule, bootstrapApplication } from '@angular/platform-browser'
import { environment } from './environments/environment'
import { logger } from './root-helpers'
import { AppComponent } from './app/app.component'
import routes from './app/app.routes'
import { ServiceWorkerModule } from '@angular/service-worker'
import { polyfillICU } from './app/helpers'
import { tap } from 'rxjs/operators'
import {
  ServerService,
  PluginService,
  RedirectService, PreloadSelectedModulesList,
  MenuGuards,
  CustomReuseStrategy,
  getCoreProviders
} from './app/core'
import { APP_BASE_HREF, registerLocaleData } from '@angular/common'
import localeOc from '@app/helpers/locales/oc'
import { RouteReuseStrategy, provideRouter, withInMemoryScrolling, withPreloading } from '@angular/router'
import { provideHttpClient } from '@angular/common/http'
import { LoadingBarModule } from '@ngx-loading-bar/core'
import { LoadingBarHttpClientModule } from '@ngx-loading-bar/http-client'
import { NgbModalModule } from '@ng-bootstrap/ng-bootstrap'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { ToastModule } from 'primeng/toast'
import { getMainProviders } from './app/shared/shared-main/main-providers'
import { getFormProviders } from '@app/shared/shared-forms/shared-form-providers'

registerLocaleData(localeOc, 'oc')

export function loadConfigFactory (server: ServerService, pluginService: PluginService, redirectService: RedirectService) {
  const initializeServices = () => {
    redirectService.init()
    pluginService.initializePlugins()
  }

  return () => {
    const result = server.loadHTMLConfig()
    if (result) return result.pipe(tap(() => initializeServices()))

    initializeServices()
  }
}

if (environment.production) {
  enableProdMode()
}

logger.registerServerSending(environment.apiUrl)

const bootstrap = () => bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserModule,
      BrowserAnimationsModule,
      ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production })
    ),

    provideHttpClient(),

    importProvidersFrom(
      LoadingBarHttpClientModule,
      LoadingBarModule,
      ToastModule,
      NgbModalModule
    ),

    getCoreProviders(),
    getMainProviders(),
    getFormProviders(),

    PreloadSelectedModulesList,
    ...MenuGuards.guards,
    { provide: RouteReuseStrategy, useClass: CustomReuseStrategy },

    provideRouter(routes,
      withPreloading(PreloadSelectedModulesList),
      withInMemoryScrolling({
        anchorScrolling: 'disabled',
        // Redefined in app component
        scrollPositionRestoration: 'disabled'
      })
    ),

    {
      provide: APP_BASE_HREF,
      useValue: '/'
    },
    {
      provide: APP_INITIALIZER,
      useFactory: loadConfigFactory,
      deps: [ ServerService, PluginService, RedirectService ],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => polyfillICU,
      multi: true
    }
  ]
})
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
