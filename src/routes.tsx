import React from 'react';
import { Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

// Public pages
import Landing from '@/pages/Landing';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';
import AuthCallback from '@/pages/auth/AuthCallback';

// Protected pages
import Dashboard from '@/pages/dashboard/Dashboard';
import ClientesList from '@/pages/clientes/ClientesList';
import ClienteForm from '@/pages/clientes/ClienteForm';
import ClienteDetails from '@/pages/clientes/ClienteDetails';
import UCsList from '@/pages/ucs/UCsList';
import UCForm from '@/pages/ucs/UCForm';
import UCDetails from '@/pages/ucs/UCDetails';
import FaturasUpload from '@/pages/faturas/FaturasUpload';
import AIAssistant from '@/pages/ai/AIAssistant';
import Profile from '@/pages/profile/Profile';
import Settings from '@/pages/settings/Settings';
import PlantasSolaresList from '@/pages/plantas_solares/PlantasSolaresList';
import PlantaSolarForm from '@/pages/plantas_solares/PlantaSolarForm';
import PlantaSolarDetails from '@/pages/plantas_solares/PlantaSolarDetails';

// Routes configuration
const routes = [
  // Public routes
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPassword />,
  },
  {
    path: '/reset-password',
    element: <ResetPassword />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallback />,
  },
  
  // Protected routes
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/dashboard',
        element: <Dashboard />,
      },
      {
        path: '/clientes',
        element: <ClientesList />,
      },
      {
        path: '/clientes/novo',
        element: <ClienteForm />,
      },
      {
        path: '/clientes/detalhes/:id',
        element: <ClienteDetails />,
      },
      {
        path: '/clientes/:id/editar',
        element: <ClienteForm />,
      },
      {
        path: '/clientes/:id/ucs',
        element: <ClienteDetails />,
      },
      {
        path: '/ucs',
        element: <UCsList />,
      },
      {
        path: '/ucs/novo',
        element: <UCForm />,
      },
      {
        path: '/ucs/:id',
        element: <UCDetails />,
      },
      {
        path: '/ucs/:id/editar',
        element: <UCForm />,
      },
      {
        path: '/faturas/upload',
        element: <FaturasUpload />,
      },
      {
        path: '/ai-assistant',
        element: <AIAssistant />,
      },
      {
        path: '/perfil',
        element: <Profile />,
      },
      {
        path: '/configuracoes',
        element: <Settings />,
      },
      {
        path: '/plantas-solares',
        element: <PlantasSolaresList />,
      },
      {
        path: '/plantas-solares/novo',
        element: <PlantaSolarForm />,
      },
      {
        path: '/plantas-solares/:id',
        element: <PlantaSolarDetails />,
      },
      {
        path: '/plantas-solares/:id/editar',
        element: <PlantaSolarForm />,
      },
    ],
  },
  
  // Redirect routes
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
];

export default routes;
