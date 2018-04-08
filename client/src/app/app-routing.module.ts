import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { PreloadSelectedModulesList } from './core'

const routes: Routes = [
  {
    path: 'admin',
    loadChildren: './+admin/admin.module#AdminModule'
  }
]

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      useHash: Boolean(history.pushState) === false,
      preloadingStrategy: PreloadSelectedModulesList
    })
  ],
  providers: [
    PreloadSelectedModulesList
  ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}
