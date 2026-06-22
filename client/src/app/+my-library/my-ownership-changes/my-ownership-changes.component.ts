import { Component, ChangeDetectionStrategy } from '@angular/core'
import { MyVideoOwnershipChangesComponent } from './my-video-ownership-changes/my-video-ownership-changes.component'

@Component({
  templateUrl: './my-ownership-changes.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ MyVideoOwnershipChangesComponent ]
})
export class MyOwnershipChangesComponent {
}
