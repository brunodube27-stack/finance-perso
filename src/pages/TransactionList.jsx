import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

export default function TransactionList() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      const from = `${year}-${String(month).padStart(2, '0')}-01`
      const to = `${year}-${String(month).padStart(2, '0')}-31`

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          categories (code, name),
          accounts (name)
        `)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })

      if (!error) setTransactions(data || [])
      setLoading(false)
    }
    fetch()
  }, [month, year])

  const total = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0)

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Transactions</h1>

      {/* Sélecteur mois */}
      <div className="flex gap-2 mb-4">
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="border rounded-lg p-2 flex-1">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>
              {new Date(2000, m - 1).toLocaleString('fr-CA', { month: 'long' })}
            </option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border rounded-lg p-2">
          {[2025, 2026, 2027].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Total */}
      <div className="bg-gray-100 rounded-lg p-3 mb-4 text-right">
        <span className="text-sm text-gray-600">Total du mois : </span>
        <span className="font-bold text-lg">{total.toFixed(2)} $</span>
      </div>

      {/* Liste */}
      {loading ? (
        <p>Chargement...</p>
      ) : transactions.length === 0 ? (
        <p className="text-gray-500 text-center mt-8">Aucune transaction ce mois-ci</p>
      ) : (
        <div className="flex flex-col gap-2">
          {transactions.map(t => (
            <div key={t.id} className="border rounded-lg p-3 flex justify-between items-start">
              <div>
                <p className="font-medium">{t.merchant || t.description || '—'}</p>
                <p className="text-sm text-gray-500">{t.categories?.code} — {t.categories?.name}</p>
                <p className="text-sm text-gray-400">{t.accounts?.name} · {t.date}</p>
              </div>
              <p className="font-bold text-red-600 whitespace-nowrap ml-2">
                -{parseFloat(t.amount).toFixed(2)} $
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}