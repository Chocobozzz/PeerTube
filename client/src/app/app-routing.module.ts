import { NgModule } from '@angular/core'
import { Routes, RouterModule } from '@angular/router'

import { PreloadSelectedModulesList } from './core'

const routes: Routes = [
  {
    path: '',
    redirectTo: '/videos/list',
    pathMatch: 'full'
  },
  {
    path: 'admin',
    loadChildren: './+admin#AdminModule'
  }
]

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      useHash: Boolean(history.pushState) === false,
      preloadingStrategy: PreloadSelectedModulesList
    })
  ],
  providers: [ PreloadSelectedModulesList ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}
