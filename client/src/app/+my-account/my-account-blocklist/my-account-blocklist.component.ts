import { Component } from '@angular/core'
import { BlocklistComponentType, GenericAccountBlocklistComponent } from '@app/shared/shared-moderation'

@Component({
  selector: 'my-account-blocklist',
  styleUrls: [ '../../shared/shared-moderation/account-blocklist.component.scss' ],
  templateUrl: '../../shared/shared-moderation/account-blocklist.component.html'
})
export class MyAccountBlocklistComponent extends GenericAccountBlocklistComponent {
  mode = BlocklistComponentType.Account

  getIdentifier () {
    return 'MyAccountBlocklistComponent'
  }
}
