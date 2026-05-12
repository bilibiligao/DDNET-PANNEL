import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App.tsx';
import { Provider } from '@/provider.tsx';
import '@/styles/globals.css';

// Fix localStorage values: NapCat expects JSON-encoded strings
['theme', 'ddnet_token'].forEach(k => {
  const v = localStorage.getItem(k);
  if (v && !v.startsWith('"')) localStorage.setItem(k, JSON.stringify(v));
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Provider>
      <App />
    </Provider>
  </BrowserRouter>
);
