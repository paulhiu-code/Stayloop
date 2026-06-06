import EmailCmsDashboard from './admin/EmailCmsDashboard';

export default function AdminDashboard({
  onClose,
}: {
  onClose: () => void;
  adminEmail?: string | null;
}) {
  return <EmailCmsDashboard mode="admin" onClose={onClose} />;
}
