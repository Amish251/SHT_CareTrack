import AccountAddEntry from '../components/AccountAddEntry';
import { ACCOUNTS } from '../config';

export default function SeocAddEntryPage() {
  return <AccountAddEntry config={ACCOUNTS.seoc} />;
}
