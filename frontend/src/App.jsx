import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ToastContainer } from 'react-toastify';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { theme } from './theme';

import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/chief/Dashboard';
import PrivateRoute from './routes/PrivateRoute';
import MyRequests from './pages/employee/MyRequests';
import NewRequest from './pages/employee/NewRequest';
import ValidateRequests from './pages/chief/ValidateRequests';
import Sorties from './pages/chief/Sorties';
import CreateSortie from './pages/chief/CreateSortie';
import Vehicles from './pages/chief/Vehicles';
import Planning from './pages/chief/Planning';
import MyTrips from './pages/employee/MyTrips';
import Users from './pages/superadmin/Users';
import Import from './pages/superadmin/Import';


function App() {
  return (
    <MantineProvider theme={theme}>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                path="/"
                element={
                  <PrivateRoute allowedRoles={['employee', 'logistics_chief', 'admin', 'superadmin']}>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/mes-demandes"
                element={
                  <PrivateRoute allowedRoles={['employee', 'superadmin']}>
                    <Layout>
                      <MyRequests />
                    </Layout>
                  </PrivateRoute>
                }
              />         
              <Route
                path="/nouvelle-demande"
                element={
                  <PrivateRoute allowedRoles={['employee', 'superadmin']}>
                    <Layout>
                      <NewRequest />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/mes-trajets"
                element={
                  <PrivateRoute allowedRoles={['employee', 'superadmin']}>
                    <Layout>
                      <MyTrips />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/valider-demandes"
                element={
                  <PrivateRoute allowedRoles={['logistics_chief', 'admin', 'superadmin']}>
                    <Layout>
                      <ValidateRequests />
                    </Layout>
                  </PrivateRoute>
                }
              />                   
              <Route
                path="/sorties"
                element={
                  <PrivateRoute allowedRoles={['logistics_chief', 'admin', 'superadmin']}>
                    <Layout>
                      <Sorties />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/creer-sortie"
                element={
                  <PrivateRoute allowedRoles={['logistics_chief', 'admin', 'superadmin']}>
                    <Layout>
                      <CreateSortie />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/vehicules"
                element={
                  <PrivateRoute allowedRoles={['logistics_chief', 'admin', 'superadmin']}>
                    <Layout>
                      <Vehicles />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/planning"
                element={
                  <PrivateRoute allowedRoles={['logistics_chief', 'admin', 'superadmin']}>
                    <Layout>
                      <Planning />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/utilisateurs"
                element={
                  <PrivateRoute allowedRoles={['superadmin']}>
                    <Layout>
                      <Users />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/importation"
                element={
                  <PrivateRoute allowedRoles={['superadmin']}>
                    <Layout>
                      <Import />
                    </Layout>
                  </PrivateRoute>
                }
              />
            </Routes>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
      <Notifications />
      <ToastContainer position="top-right" autoClose={3500} theme="light" />
    </MantineProvider>
  );
}

export default App;