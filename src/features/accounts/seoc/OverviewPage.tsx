import AccountOverview from '../components/AccountOverview';
import { ACCOUNTS } from '../config';

export default function SeocOverviewPage() {
  return <AccountOverview config={ACCOUNTS.seoc} />;
}
