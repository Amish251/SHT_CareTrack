import AccountEditEntry from '../components/AccountEditEntry';
import { ACCOUNTS } from '../config';

export default function SeocEditEntryPage() {
  return <AccountEditEntry config={ACCOUNTS.seoc} />;
}
