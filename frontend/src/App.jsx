import './styles/tokens.css';
import 'leaflet/dist/leaflet.css';
import { AuthProvider } from './providers/AuthProvider.jsx';
import { ToastProvider } from './providers/ToastProvider.jsx';
import { Router } from './router/Router.jsx';

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </AuthProvider>
  );
}
