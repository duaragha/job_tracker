import { createSystem, defaultConfig, defineConfig, mergeConfigs } from '@chakra-ui/react';

const customConfig = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#f0f9ff' },
          100: { value: '#e0f2fe' },
          200: { value: '#bae6fd' },
          300: { value: '#7dd3fc' },
          400: { value: '#38bdf8' },
          500: { value: '#0ea5e9' },
          600: { value: '#0284c7' },
          700: { value: '#0369a1' },
          800: { value: '#075985' },
          900: { value: '#0c4a6e' },
        },
      },
    },
    semanticTokens: {
      colors: {
        'body-bg': {
          value: { _light: 'gray.50', _dark: 'gray.900' }
        }
      }
    },
    recipes: {
      Button: {
        defaultVariants: {
          colorScheme: 'brand'
        }
      },
      Table: {
        variants: {
          simple: {
            th: {
              borderColor: { _light: 'gray.200', _dark: 'gray.600' }
            },
            td: {
              borderColor: { _light: 'gray.200', _dark: 'gray.600' }
            }
          }
        }
      }
    }
  },
  globalCss: {
    body: {
      bg: 'body-bg'
    }
  }
});

const config = mergeConfigs(defaultConfig, customConfig);
const theme = createSystem(config);

export default theme;