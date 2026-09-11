import AccountOverview from '../components/AccountOverview';
import { ACCOUNTS } from '../config';

export default function AmbajiOverviewPage() {
  return <AccountOverview config={ACCOUNTS.ambaji} />;
}
