import { NgModule } from '@angular/core'
import { SharedFormModule } from '../shared-forms'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { SupportModalComponent } from './support-modal.component'

@NgModule({
  imports: [
    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule
  ],

  declarations: [
    SupportModalComponent
  ],

  exports: [
    SupportModalComponent
  ],

  providers: [ ]
})
export class SharedSupportModal { }
