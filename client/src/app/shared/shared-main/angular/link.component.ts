import { Component, Input, OnInit } from '@angular/core'

@Component({
  selector: 'my-link',
  styleUrls: [ './link.component.scss' ],
  templateUrl: './link.component.html'
})
export class LinkComponent implements OnInit {
  @Input() internalLink?: string | any[]

  @Input() href?: string
  @Input() target = '_self'

  @Input() title?: string

  @Input() className?: string

  @Input() tabindex: string | number

  builtClasses: string

  ngOnInit () {
    this.builtClasses = this.className
      ? this.className
      : 'no-class'
  }
}
