import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { SharedSearchModule } from '@app/shared/shared-search'
import { RemoteInteractionRoutingModule } from './remote-interaction-routing.module'
import { RemoteInteractionComponent } from './remote-interaction.component'

@NgModule({
  imports: [
    CommonModule,

    SharedSearchModule,

    RemoteInteractionRoutingModule
  ],

  declarations: [
    RemoteInteractionComponent
  ],

  exports: [
    RemoteInteractionComponent
  ],

  providers: []
})
export class RemoteInteractionModule { }
