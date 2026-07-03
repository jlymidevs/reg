import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { EmployeeDetails } from './pages/EmployeeDetails';

function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        {/* We'll map the main route to EmployeeDetails for demonstration */}
        <Route index element={<Navigate to="/employee" replace />} />
        <Route path="employee" element={<EmployeeDetails />} />
        
        {/* Placeholders for other routes */}
        <Route path="inbox" element={<div className="p-4 text-muted">Inbox Page (Not Implemented)</div>} />
        <Route path="calendar" element={<div className="p-4 text-muted">Calendar Page (Not Implemented)</div>} />
        <Route path="attendance" element={<div className="p-4 text-muted">Attendance Page (Not Implemented)</div>} />
        <Route path="performance" element={<div className="p-4 text-muted">Performance Page (Not Implemented)</div>} />
        <Route path="payroll" element={<div className="p-4 text-muted">Payroll Page (Not Implemented)</div>} />
        <Route path="leaves" element={<div className="p-4 text-muted">Leave Management Page (Not Implemented)</div>} />
        <Route path="recruitment" element={<div className="p-4 text-muted">Recruitment Page (Not Implemented)</div>} />
      </Route>
    </Routes>
  );
}

export default App;
