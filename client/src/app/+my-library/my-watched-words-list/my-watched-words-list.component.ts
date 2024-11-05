import { Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { WatchedWordsListAdminOwnerComponent } from '@app/shared/standalone-watched-words/watched-words-list-admin-owner.component'

@Component({
  templateUrl: './my-watched-words-list.component.html',
  standalone: true,
  imports: [
    GlobalIconComponent,
    WatchedWordsListAdminOwnerComponent,
    RouterLink
  ]
})
export class MyWatchedWordsListComponent {

}
