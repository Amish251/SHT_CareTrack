import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * Compact, icon-only action buttons for table rows.
 *
 * Every one carries both `title` (hover tooltip for mouse users) and
 * `aria-label` (for screen readers), because an icon with no text is
 * meaningless to either group without them. The visible column header is
 * "Actions" — the icons themselves are intentionally label-free to keep
 * rows short, which is the whole point of switching away from text buttons.
 */

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'whatsapp';
  disabled?: boolean;
  title?: string;
}

export function IconButton({ icon, label, onClick, variant = 'default', disabled, title }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn ${variant}`}
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

interface IconLinkProps {
  icon: ReactNode;
  label: string;
  to: string;
}

export function IconLink({ icon, label, to }: IconLinkProps) {
  return (
    <Link to={to} className="icon-btn" title={label} aria-label={label}>
      {icon}
    </Link>
  );
}
