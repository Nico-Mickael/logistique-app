import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ToastContainer } from 'react-toastify';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { theme } from './theme';

import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/chief/Dashboard';
import PrivateRoute from './routes/PrivateRoute';

function App() {
  return (
    <MantineProvider theme={theme}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Notifications />
      <ToastContainer position="top-right" autoClose={3500} theme="light" />
    </MantineProvider>
  );
}

export default App;