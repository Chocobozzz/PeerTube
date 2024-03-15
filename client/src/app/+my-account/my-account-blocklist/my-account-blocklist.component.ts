import { Component } from '@angular/core'
import { NgIf, DatePipe } from '@angular/common'
import { AutoColspanDirective } from '../../shared/shared-main/angular/auto-colspan.directive'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { SharedModule } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { GenericAccountBlocklistComponent } from '@app/shared/shared-moderation/account-blocklist.component'
import { BlocklistComponentType } from '@app/shared/shared-moderation/blocklist.service'

@Component({
  selector: 'my-account-blocklist',
  templateUrl: '../../shared/shared-moderation/account-blocklist.component.html',
  standalone: true,
  imports: [
    GlobalIconComponent,
    TableModule,
    SharedModule,
    AdvancedInputFilterComponent,
    NgbTooltip,
    ActorAvatarComponent,
    AutoColspanDirective,
    NgIf,
    DatePipe
  ]
})
export class MyAccountBlocklistComponent extends GenericAccountBlocklistComponent {
  mode = BlocklistComponentType.Account

  getIdentifier () {
    return 'MyAccountBlocklistComponent'
  }
}
