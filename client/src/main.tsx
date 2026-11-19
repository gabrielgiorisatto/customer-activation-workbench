import { createRoot } from 'react-dom/client'
import './styles/app.css'
import DataExplorer from './features/explorer/DataExplorer.tsx'
import Guide from './features/guide/Guide.tsx'
import WorkbenchPage from './features/workbench/WorkbenchPage.tsx'

const page = location.pathname.replace(/\/$/, '')
createRoot(document.getElementById('root')!).render(
  page === '/data' ? <DataExplorer /> : page === '/guide' ? <Guide /> : <WorkbenchPage />,
)