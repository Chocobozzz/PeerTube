import { Component } from '@angular/core'
import { BlocklistComponentType, GenericServerBlocklistComponent } from '@app/shared/shared-moderation'

@Component({
  selector: 'my-account-server-blocklist',
  styleUrls: [ '../../+admin/moderation/moderation.component.scss', '../../shared/shared-moderation/server-blocklist.component.scss' ],
  templateUrl: '../../shared/shared-moderation/server-blocklist.component.html'
})
export class MyAccountServerBlocklistComponent extends GenericServerBlocklistComponent {
  mode = BlocklistComponentType.Account

  getIdentifier () {
    return 'MyAccountServerBlocklistComponent'
  }
}
