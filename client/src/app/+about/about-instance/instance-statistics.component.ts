import { Component, Input } from '@angular/core'
import { ServerStats } from '@shared/models/server'

@Component({
  selector: 'my-instance-statistics',
  templateUrl: './instance-statistics.component.html',
  styleUrls: [ './instance-statistics.component.scss' ]
})
export class InstanceStatisticsComponent {
  @Input() serverStats: ServerStats
}
