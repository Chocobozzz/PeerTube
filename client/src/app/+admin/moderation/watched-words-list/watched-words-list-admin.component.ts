import { Component, ChangeDetectionStrategy } from '@angular/core'
import { RouterLink } from '@angular/router'

import { WatchedWordsListAdminOwnerComponent } from '@app/shared/shared-watched-words/watched-words-list-admin-owner.component'

@Component({
  templateUrl: './watched-words-list-admin.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    RouterLink,
    WatchedWordsListAdminOwnerComponent
  ]
})
export class WatchedWordsListAdminComponent {}
