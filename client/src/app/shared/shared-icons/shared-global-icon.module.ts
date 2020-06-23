
import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { GlobalIconComponent } from './global-icon.component'

@NgModule({
  imports: [
    CommonModule
  ],

  declarations: [
    GlobalIconComponent
  ],

  exports: [
    GlobalIconComponent
  ],

  providers: [ ]
})
export class SharedGlobalIconModule { }
