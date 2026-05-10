import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './app/App';
import { store } from './app/store';
import { ThemeProvider } from './shared/theme/ThemeProvider';
import { readStoredAppThemeId } from './shared/theme/appThemes';

document.documentElement.dataset.appTheme = readStoredAppThemeId();

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
