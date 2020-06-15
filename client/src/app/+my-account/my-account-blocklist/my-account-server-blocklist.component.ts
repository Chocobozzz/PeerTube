import { Component } from '@angular/core'
import { GenericServerBlocklistComponent, BlocklistComponentType } from '@app/shared/blocklist'

@Component({
  selector: 'my-account-server-blocklist',
  styleUrls: [ '../../+admin/moderation/moderation.component.scss', '../../shared/blocklist/server-blocklist.component.scss' ],
  templateUrl: '../../shared/blocklist/server-blocklist.component.html'
})
export class MyAccountServerBlocklistComponent extends GenericServerBlocklistComponent {
  mode = BlocklistComponentType.Account

  getIdentifier () {
    return 'MyAccountServerBlocklistComponent'
  }
}
