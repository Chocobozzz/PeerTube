import { Component, Input } from '@angular/core';

@Component({
  selector: 'my-loader',
  styleUrls: [ 'client/app/videos/shared/loader/loader.component.css' ],
  templateUrl: 'client/app/videos/shared/loader/loader.component.html'
})

export class LoaderComponent {
  @Input() loading: boolean;
}
