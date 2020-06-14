import { Component } from '@angular/core'
import { GenericAccountBlocklistComponent, BlocklistComponentType } from '@app/shared/blocklist'

@Component({
  selector: 'my-account-blocklist',
  styleUrls: [ '../../shared/blocklist/account-blocklist.component.scss' ],
  templateUrl: '../../shared/blocklist/account-blocklist.component.html'
})
export class MyAccountBlocklistComponent extends GenericAccountBlocklistComponent {
  mode = BlocklistComponentType.Account

  getIdentifier () {
    return 'MyAccountBlocklistComponent'
  }
}
