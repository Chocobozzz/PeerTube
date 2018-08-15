import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-loader',
  styleUrls: [ ],
  templateUrl: './loader.component.html'
})

export class LoaderComponent {
  @Input() loading: boolean
}
