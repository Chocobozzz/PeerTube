import { Component } from '@angular/core'

import { WatchedWordsListAdminOwnerComponent } from '@app/shared/standalone-watched-words/watched-words-list-admin-owner.component'

@Component({
  templateUrl: './watched-words-list-admin.component.html',
  imports: [
    WatchedWordsListAdminOwnerComponent
  ]
})
export class WatchedWordsListAdminComponent {}
