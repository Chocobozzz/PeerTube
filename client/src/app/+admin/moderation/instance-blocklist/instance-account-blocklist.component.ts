import { Component } from '@angular/core'
import { GenericAccountBlocklistComponent, BlocklistComponentType } from '@app/shared/blocklist'

@Component({
  selector: 'my-instance-account-blocklist',
  styleUrls: [ '../moderation.component.scss', '../../../shared/blocklist/account-blocklist.component.scss' ],
  templateUrl: '../../../shared/blocklist/account-blocklist.component.html'
})
export class InstanceAccountBlocklistComponent extends GenericAccountBlocklistComponent {
  mode = BlocklistComponentType.Instance

  getIdentifier () {
    return 'InstanceAccountBlocklistComponent'
  }
}
