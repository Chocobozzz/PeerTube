import { Routes } from '@angular/router'
import { LoginGuard } from '@app/core'
import { RemoteInteractionComponent } from './remote-interaction.component'
import { FindInBulkService, SearchService } from '@app/shared/shared-search'

export default [
  {
    path: '',
    component: RemoteInteractionComponent,
    providers: [
      FindInBulkService,
      SearchService
    ],
    canActivate: [ LoginGuard ],
    data: {
      meta: {
        title: $localize`Remote interaction`
      }
    }
  }
] satisfies Routes
