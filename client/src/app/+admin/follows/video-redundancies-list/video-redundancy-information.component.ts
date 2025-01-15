import { Component, Input } from '@angular/core'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { FileRedundancyInformation, StreamingPlaylistRedundancyInformation } from '@peertube/peertube-models'
import { BytesPipe } from '../../../shared/shared-main/common/bytes.pipe'

@Component({
  selector: 'my-video-redundancy-information',
  templateUrl: './video-redundancy-information.component.html',
  styleUrls: [ './video-redundancy-information.component.scss' ],
  standalone: true,
  imports: [ PTDatePipe, BytesPipe ]
})
export class VideoRedundancyInformationComponent {
  @Input() redundancyElement: FileRedundancyInformation | StreamingPlaylistRedundancyInformation
}
