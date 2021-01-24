import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { LoginGuard } from '@app/core'
import { RemoteInteractionComponent } from './remote-interaction.component'

const remoteInteractionRoutes: Routes = [
  {
    path: '',
    component: RemoteInteractionComponent,
    canActivate: [ LoginGuard ],
    data: {
      meta: {
        title: $localize`Remote interaction`
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(remoteInteractionRoutes) ],
  exports: [ RouterModule ]
})
export class RemoteInteractionRoutingModule {}
