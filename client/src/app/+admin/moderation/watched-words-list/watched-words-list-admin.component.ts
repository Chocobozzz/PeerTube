import { Component } from '@angular/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { WatchedWordsListAdminOwnerComponent } from '@app/shared/standalone-watched-words/watched-words-list-admin-owner.component'

@Component({
  templateUrl: './watched-words-list-admin.component.html',
  imports: [
    GlobalIconComponent,
    WatchedWordsListAdminOwnerComponent
  ]
})
export class WatchedWordsListAdminComponent { }
