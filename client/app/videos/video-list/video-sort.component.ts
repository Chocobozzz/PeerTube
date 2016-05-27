import { Component, EventEmitter, Input, Output } from '@angular/core';

import { SortField } from '../shared/index';

@Component({
  selector: 'my-video-sort',
  // styleUrls: [ 'app/angular/videos/components/list/video-sort.component.css' ],
  templateUrl: 'client/app/videos/video-list/video-sort.component.html'
})

export class VideoSortComponent {
  @Output() sort = new EventEmitter<any>();

  @Input() currentSort: SortField;

  sortChoices = {
    'name': 'Name - Asc',
    '-name': 'Name - Desc',
    'duration': 'Duration - Asc',
    '-duration': 'Duration - Desc',
    'createdDate': 'Created Date - Asc',
    '-createdDate': 'Created Date - Desc'
  };

  get choiceKeys() {
    return Object.keys(this.sortChoices);
  }

  getStringChoice(choiceKey: SortField): string {
    return this.sortChoices[choiceKey];
  }

  onSortChange() {
    this.sort.emit(this.currentSort);
  }
}
