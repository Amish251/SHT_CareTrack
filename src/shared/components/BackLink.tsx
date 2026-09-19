import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackLinkProps {
  to: string;
  label: string;
}

/** A clearly visible "back to the listing" link for Add/form pages — same
 *  .btn.secondary styling used for Cancel buttons elsewhere in the app. */
export default function BackLink({ to, label }: BackLinkProps) {
  return (
    <Link to={to} className="btn small secondary">
      <ArrowLeft size={14} />
      {label}
    </Link>
  );
}
