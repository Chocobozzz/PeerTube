import { NgModuleRef, ApplicationRef } from '@angular/core'
import { createNewHosts } from '@angularclass/hmr'
import { enableDebugTools } from '@angular/platform-browser'

export const hmrBootstrap = (module: any, bootstrap: () => Promise<NgModuleRef<any>>) => {
  let ngModule: NgModuleRef<any>
  module.hot.accept()
  bootstrap()
    .then(mod => {
      ngModule = mod

      const applicationRef = ngModule.injector.get(ApplicationRef)
      const componentRef = applicationRef.components[ 0 ]
      // allows to run `ng.profiler.timeChangeDetection();`
      enableDebugTools(componentRef)
    })
  module.hot.dispose(() => {
    const appRef: ApplicationRef = ngModule.injector.get(ApplicationRef)
    const elements = appRef.components.map(c => c.location.nativeElement)
    const makeVisible = createNewHosts(elements)
    ngModule.destroy()
    makeVisible()
  })
}
