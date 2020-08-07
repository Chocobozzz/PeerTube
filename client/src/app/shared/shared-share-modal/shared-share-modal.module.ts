import { QRCodeModule } from 'angularx-qrcode'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '../shared-forms'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { VideoShareComponent } from './video-share.component'

@NgModule({
  imports: [
    QRCodeModule,

    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule
  ],

  declarations: [
    VideoShareComponent
  ],

  exports: [
    VideoShareComponent
  ],

  providers: [ ]
})
export class SharedShareModal { }
