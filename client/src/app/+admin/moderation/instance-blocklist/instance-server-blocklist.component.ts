import { Component } from '@angular/core'
import { BatchDomainsModalComponent } from '../../../shared/shared-moderation/batch-domains-modal.component'
import { NgIf, DatePipe } from '@angular/common'
import { AutoColspanDirective } from '../../../shared/shared-main/angular/auto-colspan.directive'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { AdvancedInputFilterComponent } from '../../../shared/shared-forms/advanced-input-filter.component'
import { SharedModule } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { GenericServerBlocklistComponent } from '@app/shared/shared-moderation/server-blocklist.component'
import { BlocklistComponentType } from '@app/shared/shared-moderation/blocklist.service'

@Component({
  selector: 'my-instance-server-blocklist',
  styleUrls: [ '../../../shared/shared-moderation/server-blocklist.component.scss' ],
  templateUrl: '../../../shared/shared-moderation/server-blocklist.component.html',
  standalone: true,
  imports: [
    GlobalIconComponent,
    TableModule,
    SharedModule,
    AdvancedInputFilterComponent,
    NgbTooltip,
    AutoColspanDirective,
    NgIf,
    BatchDomainsModalComponent,
    DatePipe
  ]
})
export class InstanceServerBlocklistComponent extends GenericServerBlocklistComponent {
  mode = BlocklistComponentType.Instance

  getIdentifier () {
    return 'InstanceServerBlocklistComponent'
  }
}
