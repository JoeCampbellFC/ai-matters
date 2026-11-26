import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { WorkspacesPage } from '@/pages/WorkspacesPage'
import { WorkspaceDetailPage } from '@/pages/WorkspaceDetailPage'
import { MatterDashboardPage } from '@/pages/MatterDashboardPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PlaybooksPage } from '@/pages/PlaybooksPage'
import { MatterFieldsPage } from '@/pages/MatterFieldsPage'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/workspaces" replace />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/workspaces/:id" element={<WorkspaceDetailPage />} />
        <Route path="/workspaces/:id/dashboard" element={<MatterDashboardPage />} />
        <Route path="/playbooks" element={<PlaybooksPage />} />
        <Route path="/matter-fields" element={<MatterFieldsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  )
}

export default App
