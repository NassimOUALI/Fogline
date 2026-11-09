import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createTauriServices, isTauri } from './services/tauri-services';
import './styles.css';
import { applyTheme } from './theme/theme';
import { App, NeedsDesktopShell, StartupError } from './ui/App';
import { ServicesProvider } from './ui/services-context';

applyTheme(document.documentElement, undefined);

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Missing #root element');
}
const root = createRoot(container);

if (!isTauri()) {
  root.render(<NeedsDesktopShell />);
} else {
  createTauriServices().then(
    (services) => {
      root.render(
        <StrictMode>
          <ServicesProvider services={services}>
            <App />
          </ServicesProvider>
        </StrictMode>,
      );
    },
    (error: unknown) => {
      root.render(<StartupError error={error} />);
    },
  );
}
