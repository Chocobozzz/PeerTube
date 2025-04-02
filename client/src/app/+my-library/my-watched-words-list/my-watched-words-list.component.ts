import { Component } from '@angular/core'
import { RouterLink } from '@angular/router'

import { WatchedWordsListAdminOwnerComponent } from '@app/shared/standalone-watched-words/watched-words-list-admin-owner.component'

@Component({
  templateUrl: './my-watched-words-list.component.html',
  imports: [
    WatchedWordsListAdminOwnerComponent,
    RouterLink
  ]
})
export class MyWatchedWordsListComponent {
}
