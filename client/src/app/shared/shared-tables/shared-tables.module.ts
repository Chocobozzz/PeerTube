import { NgModule } from '@angular/core'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { TableExpanderIconComponent } from './table-expander-icon.component'
import { VideoCellComponent } from './video-cell.component'

@NgModule({
  imports: [
    SharedMainModule
  ],

  declarations: [
    VideoCellComponent,
    TableExpanderIconComponent
  ],

  exports: [
    VideoCellComponent,
    TableExpanderIconComponent
  ],

  providers: [
  ]
})
export class SharedTablesModule { }
