import { Component, Input } from '@angular/core';

@Component({
  selector: 'my-loader',
  styleUrls: [ 'app/angular/videos/loader.component.css' ],
  templateUrl: 'app/angular/videos/loader.component.html'
})

export class LoaderComponent {
  @Input() loading: boolean;
}
