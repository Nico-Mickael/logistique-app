import { MantineProvider } from '@mantine/core';
import { ToastContainer } from 'react-toastify';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { theme } from './theme';

import Login from './pages/Login';
import Layout from './components/Layout';
import Accueil from './pages/Accueil';
import LoginConfetti from './components/LoginConfetti';

import PrivateRoute from './routes/PrivateRoute';
import MyRequests from './pages/employee/MyRequests';
import NewRequest from './pages/employee/NewRequest';
import ValidateRequests from './pages/chief/ValidateRequests';
import Sorties from './pages/chief/Sorties';
import CreateSortie from './pages/chief/CreateSortie';
import Vehicles from './pages/chief/Vehicles';
import Planning from './pages/chief/Planning';
import Reports from './pages/chief/Reports';
import MyTrips from './pages/employee/MyTrips';
import MyReports from './pages/employee/MyReports';
import DriverSorties from './pages/chauffeur/DriverSorties';
import Users from './pages/superadmin/Users';
import Sessions from './pages/Sessions';
import ErrorPage from './pages/ErrorPage';


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
                  <PrivateRoute allowedRoles={['employee', 'chauffeur', 'logistics_chief', 'admin', 'superadmin']}>
                    <Layout>
                      <Accueil />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/mes-demandes"
                element={
                  <PrivateRoute allowedRoles={['employee', 'chauffeur', 'superadmin']}>
                    <Layout>
                      <MyRequests />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/nouvelle-demande"
                element={
                  <PrivateRoute allowedRoles={['employee', 'chauffeur', 'superadmin']}>
                    <Layout>
                      <NewRequest />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/mes-trajets"
                element={
                  <PrivateRoute allowedRoles={['employee', 'chauffeur', 'superadmin']}>
                    <Layout>
                      <MyTrips />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/mes-sorties"
                element={
                  <PrivateRoute allowedRoles={['chauffeur']}>
                    <Layout>
                      <DriverSorties />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/mes-rapports"
                element={
                  <PrivateRoute allowedRoles={['employee', 'chauffeur', 'superadmin']}>
                    <Layout>
                      <MyReports />
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
                path="/rapports"
                element={
                  <PrivateRoute allowedRoles={['logistics_chief', 'admin', 'superadmin']}>
                    <Layout>
                      <Reports />
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
                path="/sessions"
                element={
                  <PrivateRoute allowedRoles={['employee', 'chauffeur', 'logistics_chief', 'admin', 'superadmin']}>
                    <Layout>
                      <Sessions />
                    </Layout>
                  </PrivateRoute>
                }
              />
              <Route path="*" element={<ErrorPage code={404} />} />
            </Routes>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
      <ToastContainer position="top-right" autoClose={3500} theme="light" />
      <LoginConfetti />
    </MantineProvider>
  );
}

export default App;