import { Component } from '@angular/core'
import { AbuseListTableComponent } from '../../shared/shared-abuse-list/abuse-list-table.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-account-abuses-list',
  templateUrl: './my-account-abuses-list.component.html',
  styleUrls: [],
  imports: [ GlobalIconComponent, AbuseListTableComponent ]
})
export class MyAccountAbusesListComponent {

}
