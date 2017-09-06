import { NgModule } from '@angular/core'
import { Routes, RouterModule, PreloadAllModules } from '@angular/router'

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
      preloadingStrategy: PreloadAllModules
    })
  ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}
