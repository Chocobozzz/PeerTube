import { Component, Input } from '@angular/core'
import { ServerStats } from '@peertube/peertube-models'
import { BytesPipe } from '../../shared/shared-main/angular/bytes.pipe'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { NgIf, DecimalPipe } from '@angular/common'

@Component({
  selector: 'my-instance-statistics',
  templateUrl: './instance-statistics.component.html',
  styleUrls: [ './instance-statistics.component.scss' ],
  standalone: true,
  imports: [ NgIf, GlobalIconComponent, DecimalPipe, BytesPipe ]
})
export class InstanceStatisticsComponent {
  @Input() serverStats: ServerStats
}
