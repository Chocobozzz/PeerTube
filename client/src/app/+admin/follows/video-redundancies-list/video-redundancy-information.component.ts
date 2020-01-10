import { Component, Input } from '@angular/core'
import { FileRedundancyInformation, StreamingPlaylistRedundancyInformation } from '@shared/models'

@Component({
  selector: 'my-video-redundancy-information',
  templateUrl: './video-redundancy-information.component.html',
  styleUrls: [ './video-redundancy-information.component.scss' ]
})
export class VideoRedundancyInformationComponent {
  @Input() redundancyElement: FileRedundancyInformation | StreamingPlaylistRedundancyInformation
}
