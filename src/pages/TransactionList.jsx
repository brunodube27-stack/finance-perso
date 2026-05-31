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
      const mm = String(month).padStart(2, '0')
      const lastDay = new Date(year, month, 0).getDate()
      const from = `${year}-${mm}-01`
      const to = `${year}-${mm}-${lastDay}`

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
    <div className="max-w-md mx-auto px-4 pt-4 pb-28">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Transactions</h1>

      <div className="flex gap-2 mb-4">
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>
              {new Date(2000, m - 1).toLocaleString('fr-CA', { month: 'long' })}
            </option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 mb-4 flex justify-between items-center">
        <span className="text-sm text-slate-500">Total du mois</span>
        <span className="font-bold text-slate-800">{total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Chargement...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">Aucune transaction ce mois-ci</div>
      ) : (
        <div className="flex flex-col gap-2">
          {transactions.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex justify-between items-start">
              <div className="flex-1 min-w-0 mr-3">
                <p className="font-medium text-sm text-slate-800 truncate">{t.merchant || t.description || '—'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t.categories?.code} — {t.categories?.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t.accounts?.name} · {t.date}</p>
              </div>
              <p className="font-semibold text-sm text-red-500 whitespace-nowrap">
                -{parseFloat(t.amount).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}