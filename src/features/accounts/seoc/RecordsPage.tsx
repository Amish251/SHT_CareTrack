import AccountRecords from '../components/AccountRecords';
import { ACCOUNTS } from '../config';

export default function SeocRecordsPage() {
  return <AccountRecords config={ACCOUNTS.seoc} />;
}
