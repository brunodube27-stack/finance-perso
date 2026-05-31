import DepensesListe from '../components/DepensesListe'
import RevenusListe from '../components/RevenusListe'

export default function TransactionList() {
  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-28">
      <DepensesListe />
      <RevenusListe />
    </div>
  )
}