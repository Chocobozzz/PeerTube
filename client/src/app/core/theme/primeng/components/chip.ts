import { ChipDesignTokens } from '@primeng/themes/types/chip'

export default {
  root: {
    borderRadius: '4px',
    paddingX: '15px',
    paddingY: '2px',
    gap: '0.5rem',
    transitionDuration: '{transition.duration}'
  },
  image: {
    width: '2rem',
    height: '2rem'
  },
  icon: {
    size: '1rem'
  },
  removeIcon: {
    size: '1rem',
    focusRing: {
      width: '{focus.ring.width}',
      style: '{focus.ring.style}',
      color: '{focus.ring.color}',
      offset: '{focus.ring.offset}',
      shadow: '{focus.ring.shadow}'
    }
  },
  colorScheme: {
    light: {
      root: {
        background: 'var(--input-bg-550)',
        color: 'var(--fg)'
      },
      icon: {
        color: 'var(--fg)'
      },
      removeIcon: {
        color: 'var(--fg)'
      }
    }
  }
} as ChipDesignTokens
