import { Component, Input } from '@angular/core'
import { FileRedundancyInformation, StreamingPlaylistRedundancyInformation } from '@peertube/peertube-models'
import { BytesPipe } from '../../../shared/shared-main/common/bytes.pipe'
import { DatePipe } from '@angular/common'

@Component({
  selector: 'my-video-redundancy-information',
  templateUrl: './video-redundancy-information.component.html',
  styleUrls: [ './video-redundancy-information.component.scss' ],
  standalone: true,
  imports: [ DatePipe, BytesPipe ]
})
export class VideoRedundancyInformationComponent {
  @Input() redundancyElement: FileRedundancyInformation | StreamingPlaylistRedundancyInformation
}
