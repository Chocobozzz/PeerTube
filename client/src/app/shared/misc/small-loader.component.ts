import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-small-loader',
  styleUrls: [ ],
  templateUrl: './small-loader.component.html'
})

export class SmallLoaderComponent {
  @Input() loading: boolean
}
