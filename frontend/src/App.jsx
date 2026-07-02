import { ConfigProvider } from 'antd';
import { ToastContainer } from 'react-toastify';
import { theme } from './theme';

function App() {
  return (
    <ConfigProvider theme={theme}>
      <div style={{ padding: 24 }}>
        <h1>Logistique App</h1>
        <p>Frontend initialisé ✅</p>
      </div>
      <ToastContainer position="top-right" autoClose={3500} theme="light" />
    </ConfigProvider>
  );
}

export default App;