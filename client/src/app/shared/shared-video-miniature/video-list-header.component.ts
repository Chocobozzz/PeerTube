import { Component, Inject, ViewEncapsulation } from '@angular/core'

export abstract class GenericHeaderComponent {
  constructor (@Inject('data') public data: any) {}
}

@Component({
  selector: 'my-video-list-header',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './video-list-header.component.html'
})
export class VideoListHeaderComponent extends GenericHeaderComponent {
  constructor (@Inject('data') public data: any) {
    super(data)
  }
}
