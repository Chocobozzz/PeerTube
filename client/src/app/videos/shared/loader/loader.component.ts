import { Component, Input } from '@angular/core';

@Component({
  selector: 'my-loader',
  styles: [ require('./loader.component.scss') ],
  template: require('./loader.component.html')
})

export class LoaderComponent {
  @Input() loading: boolean;
}
