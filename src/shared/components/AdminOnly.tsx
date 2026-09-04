import type { ReactNode } from 'react';
import { useAuth } from './AuthGate';

interface Props {
  children: ReactNode;
  message?: string;
}

/** Wrap any page's returned JSX with this to restrict it to admin (and super
 *  admin) accounts. Staff sees a plain "Admins only" panel instead —
 *  consistent with how Users/Backup already gate themselves in Settings. */
export default function AdminOnly({ children, message }: Props) {
  const { session } = useAuth();
  if (session.role !== 'admin' && session.role !== 'superadmin') {
    return (
      <div className="empty">
        <div className="display">Admins only</div>
        <p>{message || 'This section is limited to admin accounts.'}</p>
      </div>
    );
  }
  return <>{children}</>;
}
