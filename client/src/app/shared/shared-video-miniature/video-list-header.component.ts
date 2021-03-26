import { Component, Inject, ViewEncapsulation } from '@angular/core'

export interface GenericHeaderData {
  titlePage: string
  titleTooltip?: string
}

export abstract class GenericHeaderComponent {
  constructor (@Inject('data') public data: GenericHeaderData) {}
}

@Component({
  selector: 'my-video-list-header',
  // tslint:disable-next-line:use-component-view-encapsulation
  encapsulation: ViewEncapsulation.None,
  templateUrl: './video-list-header.component.html'
})
export class VideoListHeaderComponent extends GenericHeaderComponent {
  constructor (@Inject('data') public data: GenericHeaderData) {
    super(data)
  }
}
