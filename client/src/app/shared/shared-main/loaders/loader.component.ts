import { Component, Input } from '@angular/core'
import { NgIf, NgStyle } from '@angular/common'

@Component({
  selector: 'my-loader',
  template: `<div *ngIf="loading" class="spinner-border" [ngStyle]="getStyle()" role="status"></div>`,
  standalone: true,
  imports: [ NgIf, NgStyle ]
})
export class LoaderComponent {
  @Input() loading: boolean
  @Input() size: 'sm' | 'xl'

  private readonly sizes = {
    sm: {
      'width': '1rem',
      'height': '1rem',
      'border-width': '0.15rem'
    },
    xl: {
      width: '3rem',
      height: '3rem'
    }
  }

  getStyle () {
    if (!this.size) return undefined

    return this.sizes[this.size]
  }
}
