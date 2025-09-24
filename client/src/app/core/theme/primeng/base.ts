import type { LaraBaseDesignTokens } from '@primeng/themes/lara/base'

export default {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '2px',
      sm: '4px',
      md: '6px',
      lg: '8px',
      xl: '12px'
    }
  },
  semantic: {
    transitionDuration: '0',
    focusRing: {
      width: '0',
      style: 'none',
      color: 'transparent',
      offset: '0'
    },
    disabledOpacity: '0.6',
    iconSize: '1rem',
    anchorGutter: '2px',
    primary: {
      50: 'var(--primary-50)',
      100: 'var(--primary-100)',
      200: 'var(--primary-200)',
      300: 'var(--primary-300)',
      400: 'var(--primary-400)',
      500: 'var(--primary-500)',
      600: 'var(--primary-600)',
      700: 'var(--primary-700)',
      800: 'var(--primary-800)',
      900: 'var(--primary-900)',
      950: 'var(--primary-950)'
    },
    formField: {
      paddingX: 'var(--input-x-padding)',
      paddingY: 'var(--input-y-padding)',

      borderRadius: 'var(--input-border-radius)',
      focusRing: {
        width: '{focus.ring.width}',
        style: '{focus.ring.style}',
        color: '{focus.ring.color}',
        offset: '{focus.ring.offset}',
        shadow: '{focus.ring.shadow}'
      },
      transitionDuration: '{transition.duration}'
    },
    list: {
      padding: '0.5rem 0',
      gap: '0',
      header: {
        padding: '0.5rem 1rem 0.5rem 1rem'
      },
      option: {
        padding: '0.5rem 1rem',
        borderRadius: '0'
      },
      optionGroup: {
        padding: '0.5rem 1rem',
        fontWeight: '600'
      }
    },
    content: {
      borderRadius: '{border.radius.md}'
    },
    mask: {
      transitionDuration: '0.15s'
    },
    navigation: {
      list: {
        padding: '0.5rem 0',
        gap: '0'
      },
      item: {
        padding: '0.5rem 1rem',
        borderRadius: '0',
        gap: '0.5rem'
      },
      submenuLabel: {
        padding: '0.5rem 1rem',
        fontWeight: '600'
      },
      submenuIcon: {
        size: '0.875rem'
      }
    },
    overlay: {
      select: {
        borderRadius: '{border.radius.md}',
        shadow: '0 2px 12px 0 rgba(0, 0, 0, 0.1)'
      },
      popover: {
        borderRadius: '{border.radius.md}',
        padding: '1rem',
        shadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      },
      modal: {
        borderRadius: '{border.radius.xl}',
        padding: '1.5rem',
        shadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
      },
      navigation: {
        shadow: '0 2px 12px 0 rgba(0, 0, 0, 0.1)'
      }
    },
    colorScheme: {
      light: {
        surface: {
          0: 'var(--bg-secondary-0)',
          50: 'var(--bg-secondary-50)',
          100: 'var(--bg-secondary-100)',
          200: 'var(--bg-secondary-200)',
          300: 'var(--bg-secondary-300)',
          400: 'var(--bg-secondary-400)',
          500: 'var(--bg-secondary-500)',
          600: 'var(--bg-secondary-600)',
          700: 'var(--bg-secondary-700)',
          800: 'var(--bg-secondary-800)',
          900: 'var(--bg-secondary-900)',
          950: 'var(--bg-secondary-950)'
        },
        primary: {
          color: '{primary.500}',
          contrastColor: 'var(--on-primary)',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}'
        },
        highlight: {
          background: 'var(--primary)',
          focusBackground: 'var(--primary)',
          color: 'var(--on-primary)',
          focusColor: 'var(--on-primary)'
        },
        focusRing: {
          shadow: '0 0 0 0.2rem var(--fg-100)'
        },
        mask: {
          background: 'rgba(0,0,0,0.4)',
          color: '{surface.200}'
        },
        formField: {
          background: 'var(--input-bg)',
          disabledBackground: 'inherit',
          filledBackground: '{surface.50}',
          filledHoverBackground: '{surface.50}',
          filledFocusBackground: '{surface.0}',
          borderColor: 'var(--input-border-color)',
          hoverBorderColor: 'var(--input-border-color)',
          focusBorderColor: 'var(--input-border-color)',
          invalidBorderColor: 'var(--red)',
          color: 'var(--input-fg)',
          disabledColor: 'var(--fg-300)',
          placeholderColor: 'var(--input-placeholder-color)',
          invalidPlaceholderColor: 'var(--red)',
          floatLabelColor: 'var(--fg-300)',
          floatLabelFocusColor: 'var(--primary)',
          floatLabelActiveColor: 'var(--fg)',
          floatLabelInvalidColor: '{form.field.invalid.placeholder.color}',
          iconColor: 'var(--fg-300)',
          shadow: 'none'
        },
        text: {
          color: 'var(--fg)',
          hoverColor: 'var(--fg)',
          mutedColor: 'var(--fg)',
          hoverMutedColor: 'var(--fg)'
        },
        content: {
          background: 'var(--bg)',
          hoverBackground: 'var(--bg)',
          borderColor: 'var(--input-border-color)',
          color: 'var(--fg)',
          hoverColor: 'var(--fg)'
        },
        overlay: {
          select: {
            background: 'var(--bg)',
            borderColor: 'var(--input-border-color)',
            color: 'var(--fg)'
          },
          popover: {
            background: 'var(--bg)',
            borderColor: 'var(--input-border-color)',
            color: 'var(--fg)'
          },
          modal: {
            background: 'var(--bg)',
            borderColor: 'var(--input-border-color)',
            color: 'var(--fg)'
          }
        },
        list: {
          option: {
            focusBackground: 'var(--bg-secondary-450)',
            selectedBackground: 'var(--bg-secondary-500)',
            selectedFocusBackground: 'var(--bg-secondary-500)',
            color: '{text.color}',
            focusColor: '{text.color}',
            selectedColor: '{text.color}',
            selectedFocusColor: '{text.color}',
            icon: {
              color: '{surface.400}',
              focusColor: '{surface.500}'
            }
          },
          optionGroup: {
            background: 'var(--bg-secondary-500)',
            color: '{text.color}'
          }
        },

        // TODO
        navigation: {
          item: {
            focusBackground: '{surface.100}',
            activeBackground: '{surface.100}',
            color: '{text.color}',
            focusColor: '{text.hover.color}',
            activeColor: '{text.hover.color}',
            icon: {
              color: '{surface.400}',
              focusColor: '{surface.500}',
              activeColor: '{surface.500}'
            }
          },
          submenuLabel: {
            background: 'transparent',
            color: '{text.color}'
          },
          submenuIcon: {
            color: '{surface.400}',
            focusColor: '{surface.500}',
            activeColor: '{surface.500}'
          }
        }
      }
    }
  }
} satisfies LaraBaseDesignTokens
