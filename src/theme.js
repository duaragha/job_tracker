import { extendTheme } from '@chakra-ui/react';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  colors: {
    brand: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
  },
  styles: {
    global: (props) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'gray.900' : 'gray.50',
      },
    }),
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
    Table: {
      variants: {
        simple: {
          th: {
            borderColor: 'gray.200',
            _dark: {
              borderColor: 'gray.600',
            },
          },
          td: {
            borderColor: 'gray.200',
            _dark: {
              borderColor: 'gray.600',
            },
          },
        },
      },
    },
  },
});

export default theme;