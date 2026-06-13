import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './app/App';
import { store } from './app/store';
import { ThemeProvider } from './shared/theme/ThemeProvider';
import { applyCatalogTheme, getCatalogTheme, readStoredCatalogThemeId } from './shared/theme/catalogTheme';

const bootThemeId = readStoredCatalogThemeId();
const bootTheme = getCatalogTheme(bootThemeId);
if (bootTheme) applyCatalogTheme(bootTheme, bootThemeId);

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </Provider>
    </ThemeProvider>
  </StrictMode>,
);
