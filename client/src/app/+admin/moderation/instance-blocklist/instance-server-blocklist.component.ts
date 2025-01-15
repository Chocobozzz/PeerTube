import { NgIf } from '@angular/common'
import { Component } from '@angular/core'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { BlocklistComponentType } from '@app/shared/shared-moderation/blocklist.service'
import { GenericServerBlocklistComponent } from '@app/shared/shared-moderation/server-blocklist.component'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { SharedModule } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { AdvancedInputFilterComponent } from '../../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { AutoColspanDirective } from '../../../shared/shared-main/common/auto-colspan.directive'
import { BatchDomainsModalComponent } from '../../../shared/shared-moderation/batch-domains-modal.component'

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
    PTDatePipe
  ]
})
export class InstanceServerBlocklistComponent extends GenericServerBlocklistComponent {
  mode = BlocklistComponentType.Instance

  getIdentifier () {
    return 'InstanceServerBlocklistComponent'
  }
}
