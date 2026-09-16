import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEquipmentData } from '@/features/equipment-register/store';
import { engagedUnits, freeUnits } from '@/features/equipment-register/helpers';
import { useFinanceData } from '@/features/finance/store';
import { useAccountData } from '@/features/accounts/store';
import { ACCOUNTS } from '@/features/accounts/config';
import { LayoutDashboard, Boxes, PiggyBank, Landmark, Building2, ArrowRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="card">
      <h3 className="card-eyebrow">{label}</h3>
      <div className="num mono" style={{ fontSize: 22, color: color || 'var(--ink)' }}>
        {value}
      </div>
    </div>
  );
}

interface ModulePanelProps {
  accent: 'equipment' | 'donation' | 'ambaji' | 'seoc';
  icon: ReactNode;
  title: string;
  subtitle: string;
  viewAllTo: string;
  children: ReactNode;
}

function ModulePanel({ accent, icon, title, subtitle, viewAllTo, children }: ModulePanelProps) {
  const badgeClass =
    accent === 'donation' ? 'sage' : accent === 'ambaji' ? 'marigold' : accent === 'seoc' ? 'violet' : '';
  return (
    <div className={`panel module-panel module-panel-${accent}`}>
      <div className="panel-head" style={{ marginBottom: 16 }}>
        <div className="page-head-icon-row">
          <div className={`icon-badge sm ${badgeClass}`}>{icon}</div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
            <p className="sub" style={{ margin: '2px 0 0', fontSize: 12 }}>
              {subtitle}
            </p>
          </div>
        </div>
        <Link to={viewAllTo} className="btn small secondary">
          View details <ArrowRight />
        </Link>
      </div>
      <div className="grid">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [equipment] = useEquipmentData();
  const [finance] = useFinanceData();
  const [ambaji] = useAccountData(ACCOUNTS.ambaji.namespace);
  const [seoc] = useAccountData(ACCOUNTS.seoc.namespace);

  // --- Equipment & Stock ---
  const totalTypes = equipment.types.length;
  const totalUnits = equipment.types.reduce((sum, t) => sum + t.units.length, 0);
  const totalEngaged = equipment.types.reduce((sum, t) => sum + engagedUnits(t).length, 0);
  const totalAvailable = equipment.types.reduce((sum, t) => sum + freeUnits(t).length, 0);
  const activeLoans = equipment.allocations.filter((a) => a.status === 'active').length;
  const returnedItems = equipment.allocations.filter((a) => a.status === 'returned').length;

  let tokenHeld = 0;
  let tokenPending = 0;
  let tokenReturned = 0;
  for (const a of equipment.allocations) {
    if (a.status === 'active') {
      if (a.depositGiven) tokenHeld += a.tokenAmount;
      else tokenPending += a.tokenAmount;
    } else if (a.status === 'returned' && a.depositGiven) {
      tokenReturned += a.tokenAmount;
    }
  }

  // --- Donation ---
  const totalDonations = finance.entries.filter((e) => e.kind === 'donation').reduce((s, e) => s + e.amount, 0);
  const totalExpenses = finance.entries.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);
  const donationBalance = totalDonations - totalExpenses;

  // --- Ambaji / SEOC (same credit/debit shape) ---
  const ambajiCredit = ambaji.entries.filter((e) => e.kind === 'credit').reduce((s, e) => s + e.amount, 0);
  const ambajiDebit = ambaji.entries.filter((e) => e.kind === 'debit').reduce((s, e) => s + e.amount, 0);
  const seocCredit = seoc.entries.filter((e) => e.kind === 'credit').reduce((s, e) => s + e.amount, 0);
  const seocDebit = seoc.entries.filter((e) => e.kind === 'debit').reduce((s, e) => s + e.amount, 0);

  const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div>
      <div className="page-head">
        <div className="page-head-icon-row">
          <div className="icon-badge">
            <LayoutDashboard />
          </div>
          <div>
            <h2>Dashboard</h2>
            <p className="sub">Everything at a glance — equipment &amp; stock, donations, and both accounts.</p>
          </div>
        </div>
      </div>

      <ModulePanel
        accent="equipment"
        icon={<Boxes />}
        title="Equipment & Stock"
        subtitle="Loans, returns, and security deposits"
        viewAllTo="/equipment-register"
      >
        <StatCard label="Equipment Types" value={totalTypes} />
        <StatCard label="Total Units" value={totalUnits} />
        <StatCard label="Available" value={totalAvailable} color="var(--sage-deep)" />
        <StatCard label="Engaged" value={totalEngaged} color="var(--marigold-deep)" />
        <StatCard label="Active Loans" value={activeLoans} color="var(--primary-deep)" />
        <StatCard label="Returned Items" value={returnedItems} color="var(--slate)" />
        <StatCard label="Token Held" value={rupee(tokenHeld)} color="var(--primary-deep)" />
        <StatCard label="Token Pending" value={rupee(tokenPending)} color="var(--marigold-deep)" />
        <StatCard label="Token Returned" value={rupee(tokenReturned)} color="var(--sage-deep)" />
      </ModulePanel>

      <ModulePanel
        accent="donation"
        icon={<PiggyBank />}
        title="Donation"
        subtitle="Donations received and expenses paid out"
        viewAllTo="/finance"
      >
        <StatCard label="Total Donations" value={rupee(totalDonations)} color="var(--sage-deep)" />
        <StatCard label="Total Expenses" value={rupee(totalExpenses)} color="var(--rust)" />
        <StatCard
          label="Balance"
          value={rupee(donationBalance)}
          color={donationBalance >= 0 ? 'var(--primary-deep)' : 'var(--rust)'}
        />
      </ModulePanel>

      <ModulePanel
        accent="ambaji"
        icon={<Landmark />}
        title={ACCOUNTS.ambaji.title}
        subtitle="Credit and debit ledger for this account"
        viewAllTo="/ambaji-account"
      >
        <StatCard label="Total Credit" value={rupee(ambajiCredit)} color="var(--sage-deep)" />
        <StatCard label="Total Debit" value={rupee(ambajiDebit)} color="var(--rust)" />
        <StatCard
          label="Balance"
          value={rupee(ambajiCredit - ambajiDebit)}
          color={ambajiCredit - ambajiDebit >= 0 ? 'var(--primary-deep)' : 'var(--rust)'}
        />
      </ModulePanel>

      <ModulePanel
        accent="seoc"
        icon={<Building2 />}
        title={ACCOUNTS.seoc.title}
        subtitle="Credit and debit ledger for this account"
        viewAllTo="/seoc-account"
      >
        <StatCard label="Total Credit" value={rupee(seocCredit)} color="var(--sage-deep)" />
        <StatCard label="Total Debit" value={rupee(seocDebit)} color="var(--rust)" />
        <StatCard
          label="Balance"
          value={rupee(seocCredit - seocDebit)}
          color={seocCredit - seocDebit >= 0 ? 'var(--primary-deep)' : 'var(--rust)'}
        />
      </ModulePanel>
    </div>
  );
}
