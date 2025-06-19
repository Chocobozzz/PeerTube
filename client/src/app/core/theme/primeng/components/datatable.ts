import { DataTableDesignTokens } from '@primeng/themes/types/datatable'

export default {
  root: {
    transitionDuration: '{transition.duration}'
  },
  header: {
    borderColor: '{datatable.border.color}',
    borderWidth: '0',
    padding: '0.5rem 0 1rem',
    sm: {
      padding: '0.375rem 0.5rem'
    },
    lg: {
      padding: '1rem 1.25rem'
    }
  },
  headerCell: {
    selectedBackground: 'var(--bg)',
    borderColor: '{datatable.border.color}',
    hoverColor: '{content.hover.color}',
    selectedColor: 'var(--fg-200)',
    gap: '0.5rem',
    padding: '10px 0.25rem 10px 1rem',
    focusRing: {
      width: '{focus.ring.width}',
      style: '{focus.ring.style}',
      color: '{focus.ring.color}',
      offset: '{focus.ring.offset}',
      shadow: 'inset {focus.ring.shadow}'
    },
    sm: {
      padding: '0.375rem 0.5rem'
    },
    lg: {
      padding: '1rem 1.25rem'
    }
  },
  columnTitle: {
    fontWeight: 'normal'
  },
  row: {
    background: '{content.background}',
    hoverBackground: 'var(--bg-secondary-350)',
    selectedBackground: '{content.background}',
    color: '{content.color}',
    hoverColor: '{content.hover.color}',
    selectedColor: '{content.color}',
    focusRing: {
      width: '{focus.ring.width}',
      style: '{focus.ring.style}',
      color: '{focus.ring.color}',
      offset: '{focus.ring.offset}',
      shadow: 'inset {focus.ring.shadow}'
    }
  },
  bodyCell: {
    borderColor: 'transparent',
    padding: '5px 2px 5px 1rem',
    sm: {
      padding: '0.375rem 0.5rem'
    },
    lg: {
      padding: '1rem 1.25rem'
    }
  },
  footerCell: {
    borderColor: '{datatable.border.color}',
    padding: '0.75rem 1rem',
    sm: {
      padding: '0.375rem 0.5rem'
    },
    lg: {
      padding: '1rem 1.25rem'
    }
  },
  columnFooter: {
    fontWeight: '700'
  },
  footer: {
    borderColor: '{datatable.border.color}',
    borderWidth: '0 0 1px 0',
    padding: '0.75rem 1rem',
    sm: {
      padding: '0.375rem 0.5rem'
    },
    lg: {
      padding: '1rem 1.25rem'
    }
  },
  dropPoint: {
    color: 'var(--border-primary)'
  },
  columnResizer: {
    width: '0.5rem'
  },
  resizeIndicator: {
    width: '1px',
    color: '{primary.color}'
  },
  sortIcon: {
    color: '{text.muted.color}',
    hoverColor: '{text.hover.muted.color}',
    size: '0.875rem'
  },
  loadingIcon: {
    size: '2rem'
  },
  rowToggleButton: {
    hoverBackground: '{content.hover.background}',
    selectedHoverBackground: '{content.background}',
    color: '{text.muted.color}',
    hoverColor: '{text.color}',
    selectedHoverColor: '{primary.color}',
    size: '1.75rem',
    borderRadius: '50%',
    focusRing: {
      width: '{focus.ring.width}',
      style: '{focus.ring.style}',
      color: '{focus.ring.color}',
      offset: '{focus.ring.offset}',
      shadow: '{focus.ring.shadow}'
    }
  },
  paginatorTop: {
    borderColor: '{datatable.border.color}',
    borderWidth: '0 0 1px 0'
  },
  paginatorBottom: {
    borderColor: '{datatable.border.color}',
    borderWidth: '0 0 1px 0'
  },
  colorScheme: {
    light: {
      root: {
        borderColor: 'var(--bg-secondary-450)'
      },
      header: {
        background: 'var(--bg)',
        color: 'var(--fg)'
      },
      headerCell: {
        background: 'var(--bg)',
        hoverBackground: 'var(--bg-secondary-400)',
        color: 'var(--fg-200)'
      },
      footer: {
        background: 'var(--bg)',
        color: '{text.color}'
      },
      footerCell: {
        background: 'var(--bg)',
        color: '{text.color}'
      },
      row: {
        stripedBackground: 'var(--bg-secondary-350)'
      },
      bodyCell: {
        selectedBorderColor: 'transparent'
      }
    }
  }
} as DataTableDesignTokens
