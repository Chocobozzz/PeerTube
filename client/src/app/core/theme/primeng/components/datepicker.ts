import { DatePickerDesignTokens } from '@primeng/themes/types/datepicker'

export default {
  root: {
    transitionDuration: '{transition.duration}'
  },
  panel: {
    background: 'var(--bg-secondary-400)',
    borderColor: '{content.border.color}',
    color: 'var(--fg)',
    borderRadius: '{content.border.radius}',
    shadow: '{overlay.popover.shadow}',
    padding: '{overlay.popover.padding}'
  },
  header: {
    background: 'var(--bg-secondary-400)',
    borderColor: '{content.border.color}',
    color: '{content.color}',
    padding: '0 0 0.75rem 0'
  },
  title: {
    gap: '0.5rem',
    fontWeight: '700'
  },
  dropdown: {
    width: '2.5rem',
    sm: {
      width: '2rem'
    },
    lg: {
      width: '3rem'
    },
    borderColor: '{form.field.border.color}',
    hoverBorderColor: '{form.field.border.color}',
    activeBorderColor: '{form.field.border.color}',
    borderRadius: '{form.field.border.radius}',
    focusRing: {
      width: '{form.field.focus.ring.width}',
      style: '{form.field.focus.ring.style}',
      color: '{form.field.focus.ring.color}',
      offset: '{form.field.focus.ring.offset}',
      shadow: '{form.field.focus.ring.shadow}'
    }
  },
  inputIcon: {
    color: '{form.field.icon.color}'
  },
  selectMonth: {
    hoverBackground: 'var(--bg-secondary-500)',
    color: '{content.color}',
    hoverColor: '{content.hover.color}',
    padding: '0.375rem 0.625rem',
    borderRadius: '{content.border.radius}'
  },
  selectYear: {
    hoverBackground: 'var(--bg-secondary-500)',
    color: '{content.color}',
    hoverColor: '{content.hover.color}',
    padding: '0.375rem 0.625rem',
    borderRadius: '{content.border.radius}'
  },
  group: {
    borderColor: '{content.border.color}',
    gap: '{overlay.popover.padding}'
  },
  dayView: {
    margin: '0.25rem 0 0 0'
  },
  weekDay: {
    padding: '0.375rem',
    fontWeight: '700',
    color: '{content.color}'
  },
  date: {
    hoverBackground: 'var(--bg-secondary-500)',
    selectedBackground: '{primary.color}',
    rangeSelectedBackground: '{highlight.background}',
    color: 'var(--fg)',
    hoverColor: '{content.hover.color}',
    selectedColor: '{primary.contrast.color}',
    rangeSelectedColor: '{highlight.color}',
    width: 'auto',
    height: '1.75rem',
    borderRadius: '3px',
    padding: '0.15rem',
    focusRing: {
      width: '{form.field.focus.ring.width}',
      style: '{form.field.focus.ring.style}',
      color: '{form.field.focus.ring.color}',
      offset: '{form.field.focus.ring.offset}',
      shadow: '{form.field.focus.ring.shadow}'
    }
  },
  monthView: {
    margin: '0.25rem 0 0 0'
  },
  month: {
    padding: '0.5rem',
    borderRadius: '{content.border.radius}'
  },
  yearView: {
    margin: '0.75rem 0 0 0'
  },
  year: {
    padding: '0.5rem',
    borderRadius: '{content.border.radius}'
  },
  buttonbar: {
    padding: '0.75rem 0 0 0',
    borderColor: '{content.border.color}'
  },
  timePicker: {
    padding: '0.75rem 0 0 0',
    borderColor: '{content.border.color}',
    gap: '0.5rem',
    buttonGap: '0.25rem'
  },
  colorScheme: {
    light: {
      dropdown: {
        background: 'var(--bg-secondary-400)',
        hoverBackground: 'var(--bg-secondary-500)',
        activeBackground: 'var(--primary)',
        color: 'var(--fg)',
        hoverColor: 'var(--fg)',
        activeColor: 'var(--on-primary)'
      },
      today: {
        background: 'var(--bg-secondary-600)',
        color: 'var(--fg)'
      }
    }
  }
} as DatePickerDesignTokens
