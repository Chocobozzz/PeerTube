import { Component } from '@angular/core'
import { AbuseListTableComponent } from '../../../shared/shared-abuse-list/abuse-list-table.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-abuse-list',
  templateUrl: './abuse-list.component.html',
  styleUrls: [],
  imports: [ GlobalIconComponent, AbuseListTableComponent ]
})
export class AbuseListComponent {

}
