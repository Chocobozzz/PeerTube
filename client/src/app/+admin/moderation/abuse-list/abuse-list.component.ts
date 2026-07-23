import { Component, ChangeDetectionStrategy } from '@angular/core'
import { AbuseListTableComponent } from '../../../shared/shared-abuse-list/abuse-list-table.component'

@Component({
  selector: 'my-abuse-list',
  templateUrl: './abuse-list.component.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ AbuseListTableComponent ]
})
export class AbuseListComponent {
}
