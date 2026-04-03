import { Component } from '@angular/core'
import { MyChannelOwnershipChangesComponent } from './my-channel-ownership-changes/my-channel-ownership-changes.component'
import { MyVideoOwnershipChangesComponent } from './my-video-ownership-changes/my-video-ownership-changes.component'

@Component({
  templateUrl: './my-ownership-changes.component.html',
  imports: [ MyVideoOwnershipChangesComponent, MyChannelOwnershipChangesComponent ]
})
export class MyOwnershipChangesComponent {
}
