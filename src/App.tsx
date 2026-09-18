import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Inventory from './pages/Inventory';
import Transfers from './pages/Transfers';
import Reports from './pages/Reports';
import Compliance from './pages/Compliance';
import ComplianceChecklistForm from './pages/ComplianceChecklistForm';
import ComplianceHistory from './pages/ComplianceHistory';
import Alerts from './pages/Alerts';
import Providers from './pages/Providers';
import Settings from './pages/Settings';
import Schedule from './pages/Schedule';
import Forms from './pages/Forms';
import EquipmentLifeCycle from './pages/EquipmentLifeCycle';
import UserManagement from './pages/UserManagement';
import Landing from './pages/Landing';
import PendingApproval from './pages/PendingApproval';
import MinorDevices from './pages/MinorDevices';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { mockServices } from './services/mockData';

// Component to handle dynamic page titles
function PageTitle() {
  const location = useLocation();

  React.useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Tablero de Control',
      '/inventory': 'Inventario de Equipos',
      '/transfers': 'Traslados',
      '/schedule': 'Cronograma',
      '/reports': 'Reportes de Mantenimiento',
      '/forms': 'Formatos de Registro',
      '/compliance': 'Cumplimiento Normativo',
      '/alerts': 'Alertas Críticas',
      '/providers': 'Proveedores Móviles',
      '/settings': 'Configuración de Alertas',
      '/users': 'Gestión de Usuarios',
      '/minor-devices': 'Dispositivos e Instrumental',
      '/login': 'Iniciar Sesión',
      '/welcome': 'Bienvenido',
      '/pending': 'Pendiente de Aprobación'
    };

    const path = location.pathname;
    let title = titles[path] || 'Gestión Biomédica';

    // Handle dynamic paths like /equipment/:id
    if (path.startsWith('/equipment/')) title = 'Hoja de Vida';
    if (path.startsWith('/compliance/checklist/')) title = 'Lista de Chequeo';
    
    document.title = `Biotech | ${title}`;
  }, [location]);

  return null;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  React.useEffect(() => {
    if (loading || !user || user.status !== 'active' || user.role?.toUpperCase() !== 'ADMIN') {
      return;
    }

    const checkAndSeedServices = async () => {
      try {
        const snap = await getDocs(collection(db, 'services'));
        
        // Remove old 'uci-adultos' and 'uci-intermedio' if they exist to force clean up
        const docsToDelete = snap.docs.filter(d => d.id === 'uci-adultos' || d.id === 'uci-intermedio');
        for (const d of docsToDelete) {
          try {
             const { deleteDoc } = await import('firebase/firestore');
             await deleteDoc(d.ref);
             console.log(`Deleted legacy service: ${d.id}`);
          } catch(e) {
             console.warn('Could not delete', d.id, e);
          }
        }
        
        // Always ensure 'uci' and 'ambulancia' exist, and missing mockData items
        for (const svc of mockServices) {
           const exists = snap.docs.find(d => d.id === svc.id);
           if (!exists) {
              console.log(`Seeding missing service: ${svc.id}`);
              await setDoc(doc(db, 'services', svc.id), {
                name: svc.name,
                description: svc.description
              });
           }
        }

      } catch (error) {
        console.error('Failed to sync services:', error);
      }
    };
    checkAndSeedServices();
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // If user is logged in but pending, only allow access to /pending
  if (user && user.status === 'pending') {
    return (
      <Routes>
        <Route path="/pending" element={<PendingApproval />} />
        <Route path="*" element={<Navigate to="/pending" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/welcome" element={<Landing />} />
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      
      <Route element={user ? <AppLayout /> : <Navigate to="/welcome" />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/equipment/:id" element={<EquipmentLifeCycle />} />
        <Route path="/transfers" element={<Transfers />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/forms" element={<Forms />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/compliance/checklist/:serviceId" element={<ComplianceChecklistForm />} />
        <Route path="/compliance/history" element={<ComplianceHistory />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/minor-devices" element={<MinorDevices />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/users" element={user?.role?.toUpperCase() === 'ADMIN' ? <UserManagement /> : <Navigate to="/" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PageTitle />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
