import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import theme from './theme'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

// Add error boundary and logging
console.log('Main.jsx: Starting application...');
console.log('Environment:', import.meta.env.MODE);
console.log('Supabase URL exists:', !!import.meta.env.VITE_SUPABASE_URL);
console.log('Supabase Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
  document.body.innerHTML = '<h1>Error: Root element not found</h1>';
} else {
  console.log('Root element found, rendering app...');
  
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <ChakraProvider value={theme}>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ChakraProvider>
      </StrictMode>,
    )
    console.log('App rendered successfully');
  } catch (error) {
    console.error('Error rendering app:', error);
    rootElement.innerHTML = `<div style="padding: 20px; color: red;">
      <h1>Failed to start application</h1>
      <pre>${error.message}</pre>
      <p>Check the browser console for details</p>
    </div>`;
  }
}
