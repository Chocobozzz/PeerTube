import { Component } from '@angular/core'
import { AbuseListTableComponent } from '../../shared/shared-abuse-list/abuse-list-table.component'

@Component({
  selector: 'my-account-abuses-list',
  templateUrl: './my-account-abuses-list.component.html',
  styleUrls: [],
  imports: [ AbuseListTableComponent ]
})
export class MyAccountAbusesListComponent {
}
