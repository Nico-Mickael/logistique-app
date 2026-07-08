import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'brand',
  colors: {
    brand: [
      '#E8F5E9',
      '#C8E6C9',
      '#A5D6A7',
      '#81C784',
      '#66BB6A',
      '#3FA34A',
      '#2E7D32',
      '#1B5E20',
      '#0D3310',
      '#0A1F0A',
    ],
    brandYellow: [
      '#FFF9E5',
      '#FFEFBF',
      '#FFE494',
      '#FFD968',
      '#FFCF45',
      '#F5B301',
      '#E0A400',
      '#C79000',
      '#AD7C00',
      '#946800',
    ],
  },
  primaryShade: 5,
  defaultRadius: 'md',
  fontFamily: "'Inter', system-ui, sans-serif",
  headings: { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: '600' },
  shadows: {
    xs: '0 1px 3px rgba(0,0,0,0.04)',
    sm: '0 2px 6px rgba(0,0,0,0.06)',
    md: '0 4px 12px rgba(0,0,0,0.08)',
    lg: '0 8px 24px rgba(0,0,0,0.12)',
    xl: '0 12px 36px rgba(0,0,0,0.16)',
  },
  components: {
    Paper: {
      defaultProps: {
        shadow: 'sm',
        radius: 'md',
      },
    },
    Table: {
      defaultProps: {
        striped: true,
        highlightOnHover: true,
        verticalSpacing: 'sm',
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Badge: {
      defaultProps: {
        variant: 'light',
      },
    },
    Modal: {
      defaultProps: {
        overlayProps: { backgroundOpacity: 0.5, blur: 4 },
        transitionProps: { transition: 'fade', duration: 200 },
      },
    },
  },
});
