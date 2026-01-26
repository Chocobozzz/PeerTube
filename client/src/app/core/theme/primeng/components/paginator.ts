import { PaginatorDesignTokens } from '@primeng/themes/types/paginator'

export default {
  root: {
    padding: '5px 0',
    gap: '10px',
    borderRadius: '{content.border.radius}',
    background: '{content.background}',
    color: '{content.color}',
    transitionDuration: '{transition.duration}'
  },
  navButton: {
    background: 'transparent',
    hoverBackground: 'var(--bg-secondary-400)',
    selectedBackground: 'var(--bg-secondary-450)',
    color: 'var(--fg)',
    hoverColor: 'var(--fg)',
    selectedColor: ' var(--fg)',
    width: '34px',
    height: '34px',
    borderRadius: '100%',
    focusRing: {
      width: '{focus.ring.width}',
      style: '{focus.ring.style}',
      color: '{focus.ring.color}',
      offset: '{focus.ring.offset}',
      shadow: '{focus.ring.shadow}'
    }
  },
  currentPageReport: {
    color: 'var(--fg-300)'
  },
  jumpToPageInput: {
    maxWidth: '2.5rem'
  }
} as PaginatorDesignTokens
