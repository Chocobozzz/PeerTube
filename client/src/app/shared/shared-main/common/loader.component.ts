import { booleanAttribute, Component, input } from '@angular/core'
import { NgStyle } from '@angular/common'

@Component({
  selector: 'my-loader',
  template: `
  @if (loading()) {
    <div class="spinner-border" [ngStyle]="getStyle()" role="status"></div>
  }`,
  imports: [ NgStyle ]
})
export class LoaderComponent {
  readonly loading = input(false, { transform: booleanAttribute })
  readonly size = input<'sm' | 'md' | 'xl'>()

  private readonly sizes = {
    sm: {
      'width': '1rem',
      'height': '1rem',
      'border-width': '0.15rem'
    },
    md: {
      'width': '1.5rem',
      'height': '1.5rem',
      'border-width': '0.15rem'
    },
    xl: {
      width: '3rem',
      height: '3rem'
    }
  }

  getStyle () {
    const size = this.size()
    if (!size) return undefined

    return this.sizes[size]
  }
}
