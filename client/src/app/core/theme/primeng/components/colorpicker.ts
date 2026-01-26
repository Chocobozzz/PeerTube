import { ColorPickerDesignTokens } from '@primeng/themes/types/colorpicker'

export default {
  root: {
    transitionDuration: '{transition.duration}'
  },
  preview: {
    width: '100%',
    height: '1.5rem',
    borderRadius: '{form.field.border.radius}',
    focusRing: {
      width: '{focus.ring.width}',
      style: '{focus.ring.style}',
      color: '{focus.ring.color}',
      offset: '{focus.ring.offset}',
      shadow: '{focus.ring.shadow}'
    }
  },
  panel: {
    shadow: '{overlay.popover.shadow}',
    borderRadius: '{overlay.popover.borderRadius}'
  },
  colorScheme: {
    light: {
      panel: {
        background: 'var(--bg-secondary-400)',
        borderColor: 'var(--bg-secondary-450)'
      },
      handle: {
        color: 'var(--fg)'
      }
    }
  }
} as ColorPickerDesignTokens
