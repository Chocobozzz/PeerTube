import { Component, Inject } from '@angular/core'

export abstract class GenericHeaderComponent {
  constructor (@Inject('data') public data: any) {}
}

@Component({
  selector: 'h1',
  host: { 'class': 'title-page title-page-single' },
  template: `
<div placement="bottom" [ngbTooltip]="data.titleTooltip" container="body">
  {{ data.titlePage }}
</div>
  `
})
export class VideoListHeaderComponent extends GenericHeaderComponent {
  constructor (@Inject('data') public data: any) {
    super(data)
  }
}
