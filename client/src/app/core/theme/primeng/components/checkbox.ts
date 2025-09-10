import { CheckboxDesignTokens } from '@primeng/themes/types/checkbox'

export default {
  root: {
    borderRadius: '3px',
    width: '18px',
    height: '18px',
    background: 'var(--bg)',
    checkedBackground: 'var(--primary)',
    checkedHoverBackground: 'var(--primary)',
    disabledBackground: 'var(--bg)',
    filledBackground: 'var(--primary)',
    borderColor: 'var(--fg-100)',
    hoverBorderColor: 'var(--fg)',
    focusBorderColor: 'var(--fg)',
    checkedBorderColor: 'var(--primary)',
    checkedHoverBorderColor: 'var(--primary)',
    checkedFocusBorderColor: 'var(--primary)',
    checkedDisabledBorderColor: 'var(--fg-100)',
    invalidBorderColor: '{form.field.invalid.border.color}',
    shadow: '{form.field.shadow}',
    focusRing: {
      width: '{form.field.focus.ring.width}',
      style: '{form.field.focus.ring.style}',
      color: '{form.field.focus.ring.color}',
      offset: '{form.field.focus.ring.offset}',
      shadow: '{form.field.focus.ring.shadow}'
    },
    transitionDuration: '0.2s',
    sm: {
      width: '1.25rem',
      height: '1.25rem'
    },
    lg: {
      width: '1.75rem',
      height: '1.75rem'
    }
  },
  icon: {
    size: '14px',
    color: '{form.field.color}',
    checkedColor: 'var(--on-primary)',
    checkedHoverColor: 'var(--on-primary)',
    disabledColor: '{form.field.disabled.color}',
    sm: {
      size: '0.75rem'
    },
    lg: {
      size: '1.25rem'
    }
  }
} as CheckboxDesignTokens
