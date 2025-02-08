import { NgIf } from '@angular/common'
import { Component } from '@angular/core'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { GenericAccountBlocklistComponent } from '@app/shared/shared-moderation/account-blocklist.component'
import { BlocklistComponentType } from '@app/shared/shared-moderation/blocklist.service'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { SharedModule } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { AutoColspanDirective } from '../../shared/shared-main/common/auto-colspan.directive'

@Component({
  selector: 'my-account-blocklist',
  templateUrl: '../../shared/shared-moderation/account-blocklist.component.html',
  imports: [
    TableModule,
    SharedModule,
    AdvancedInputFilterComponent,
    NgbTooltip,
    ActorAvatarComponent,
    AutoColspanDirective,
    NgIf,
    PTDatePipe
  ]
})
export class MyAccountBlocklistComponent extends GenericAccountBlocklistComponent {
  mode = BlocklistComponentType.Account

  getIdentifier () {
    return 'MyAccountBlocklistComponent'
  }
}
