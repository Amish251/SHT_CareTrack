import type { ReactNode } from 'react';
import { useAuth } from './AuthGate';

interface Props {
  children: ReactNode;
  message?: string;
}

/** Wrap any page's returned JSX with this to restrict it to the super admin
 *  account only — not even regular admins can see what's inside. */
export default function SuperAdminOnly({ children, message }: Props) {
  const { session } = useAuth();
  if (session.role !== 'superadmin') {
    return (
      <div className="empty">
        <div className="display">Super admin only</div>
        <p>{message || 'This section is limited to the super admin account.'}</p>
      </div>
    );
  }
  return <>{children}</>;
}
