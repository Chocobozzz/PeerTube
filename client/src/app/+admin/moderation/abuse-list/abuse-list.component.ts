import { Component } from '@angular/core'
import { AbuseListTableComponent } from '../../../shared/shared-abuse-list/abuse-list-table.component'

@Component({
  selector: 'my-abuse-list',
  templateUrl: './abuse-list.component.html',
  styleUrls: [],
  imports: [ AbuseListTableComponent ]
})
export class AbuseListComponent {
}
