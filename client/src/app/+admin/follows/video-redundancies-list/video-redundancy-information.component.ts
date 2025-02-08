import { Component, Input } from '@angular/core'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { RedundancyInformation } from '@peertube/peertube-models'
import { BytesPipe } from '../../../shared/shared-main/common/bytes.pipe'

@Component({
  selector: 'my-video-redundancy-information',
  templateUrl: './video-redundancy-information.component.html',
  styleUrls: [ './video-redundancy-information.component.scss' ],
  imports: [ PTDatePipe, BytesPipe ]
})
export class VideoRedundancyInformationComponent {
  @Input() redundancyElement: RedundancyInformation
}
