import { redirect } from 'next/navigation';

export default function AdminBankAccountsRedirectPage() {
  redirect('/dashboard/admin/budgets?tab=contas');
}
