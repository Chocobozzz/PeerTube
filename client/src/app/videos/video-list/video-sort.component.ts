import { Component, EventEmitter, Input, Output } from '@angular/core'

import { SortField } from '../shared'

@Component({
  selector: 'my-video-sort',
  templateUrl: './video-sort.component.html'
})

export class VideoSortComponent {
  @Output() sort = new EventEmitter<any>()

  @Input() currentSort: SortField

  sortChoices: { [ P in SortField ]: string } = {
    'name': 'Name - Asc',
    '-name': 'Name - Desc',
    'duration': 'Duration - Asc',
    '-duration': 'Duration - Desc',
    'createdAt': 'Created Date - Asc',
    '-createdAt': 'Created Date - Desc',
    'views': 'Views - Asc',
    '-views': 'Views - Desc',
    'likes': 'Likes - Asc',
    '-likes': 'Likes - Desc'
  }

  get choiceKeys () {
    return Object.keys(this.sortChoices)
  }

  getStringChoice (choiceKey: SortField) {
    return this.sortChoices[choiceKey]
  }

  onSortChange () {
    this.sort.emit(this.currentSort)
  }
}
