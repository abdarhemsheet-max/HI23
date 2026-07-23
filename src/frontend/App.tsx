import { HashRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import AuthGate from './components/AuthGate';
import AppShell from './components/AppShell';
import Toaster from './components/ui/Toaster';

import HomePage from './pages/HomePage';
import FinancePage from './pages/FinancePage';
import HabitsPage from './pages/HabitsPage';
import ProjectsPage from './pages/ProjectsPage';
import ReportViewPage from './pages/ReportViewPage';
import ManualReportEditorPage from './pages/ManualReportEditorPage';
import DocumentsPage from './pages/DocumentsPage';
import QuranPage from './pages/QuranPage';
import LearningPage from './pages/LearningPage';

// HashRouter مقصود: يضمن عمل التوجيه بلا أي إعداد إضافي على GitHub Pages
// (لا يوجد خادم لإعادة توجيه المسارات العميقة عند تحديث الصفحة أو الدخول
// المباشر برابط قسم فرعي) — الرابط يصبح مثل: username.github.io/repo/#/finance
export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AuthGate>
          <AppShell>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/reports/manual/:id" element={<ManualReportEditorPage />} />
              <Route path="/reports/:id" element={<ReportViewPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/quran" element={<QuranPage />} />
              <Route path="/learning" element={<LearningPage />} />
            </Routes>
          </AppShell>
        </AuthGate>
        <Toaster />
      </HashRouter>
    </ErrorBoundary>
  );
}
