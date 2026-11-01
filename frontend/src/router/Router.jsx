import React from 'react';
import { Landing } from '../pages/Landing.jsx';
import { Login, Register } from '../pages/Auth.jsx';
import { CitizenHome, ReportNew, MyReports } from '../pages/Citizen.jsx';
import { AdminDashboard, ZoneDetail, ReportsManage, AlertsList, CitiesManage } from '../pages/Admin.jsx';
import { ZoneHeatmap } from '../pages/Heatmap.jsx';
import { AddZone } from '../pages/AddZone.jsx';
import { useAuth } from '../providers/AuthProvider.jsx';
import { Layout } from '../ui/components.jsx';

function RequireAuth({ children, role }) {
  const { user } = useAuth();
  if (!user) {
    if (typeof window !== 'undefined' && !['/login', '/register', '/'].includes(window.location.pathname)) {
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
    }
    return <Layout><div className="card">Please <a href="/login">login</a> to continue.</div></Layout>;
  }
  if (role === 'admin' && !(user.role === 'municipal_admin' || user.role === 'system_admin')) {
    return <Layout><div className="card" role="alert">403 — admins only. <a href="/home">Back to zones</a></div></Layout>;
  }
  return children;
}

export function Router() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  // Public
  if (path === '/') return <Landing />;
  if (path.startsWith('/login')) return <Login />;
  if (path.startsWith('/register')) return <Register />;
  // Citizen
  if (path.startsWith('/home')) return <RequireAuth><CitizenHome /></RequireAuth>;
  if (path.startsWith('/report/new')) return <RequireAuth><ReportNew /></RequireAuth>;
  if (path.startsWith('/my-reports')) return <RequireAuth><MyReports /></RequireAuth>;
  // Admin
  if (path.startsWith('/admin/map')) return <RequireAuth role="admin"><ZoneHeatmap /></RequireAuth>;
  if (path.startsWith('/admin/reports')) return <RequireAuth role="admin"><ReportsManage /></RequireAuth>;
  if (path.startsWith('/admin/alerts')) return <RequireAuth role="admin"><AlertsList /></RequireAuth>;
  if (path.startsWith('/admin/zones/new')) return <RequireAuth role="admin"><AddZone /></RequireAuth>;
  if (path.startsWith('/admin/zones/')) return <RequireAuth role="admin"><ZoneDetail /></RequireAuth>;
  if (path.startsWith('/admin/cities')) return <RequireAuth role="admin"><CitiesManage /></RequireAuth>;
  if (path.startsWith('/admin')) return <RequireAuth role="admin"><AdminDashboard /></RequireAuth>;
  return <Layout><div className="card">404 — page not found. <a href="/">Go home</a></div></Layout>;
}
