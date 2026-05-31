import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const from = `${year}-${String(month).padStart(2, '0')}-01`
      const to = `${year}-${String(month).padStart(2, '0')}-31`

      const { data: incomes } = await supabase
        .from('income')
        .select('*')
        .gte('date', from)
        .lte('date', to)





      const totalIncome = incomes?.reduce((s, i) => s + parseFloat(i.amount), 0) || 0
      const totalSpending = incomes?.reduce((s, i) => s + parseFloat(i.split_spending), 0) || 0
      const totalSavings = incomes?.reduce((s, i) => s + parseFloat(i.split_savings), 0) || 0
      const totalRetirement = incomes?.reduce((s, i) => s + parseFloat(i.split_retirement), 0) || 0

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*, categories(id, code, name, block)')
        .gte('date', from)
        .lte('date', to)
        .eq('type', 'expense')

      const { data: budgets } = await supabase
        .from('budget')
        .select('*, categories(id, code, name, block)')
        .eq('year', year)

      const { data: budgetConfig } = await supabase
        .from('income_target')
        .select('amount_target')
        .eq('year', year)
        .single()

      const revenuCible = budgetConfig ? parseFloat(budgetConfig.amount_target) / 12 : 0

      const spentMap = {}
      transactions?.forEach(t => {
        const id = t.categories?.id
        if (!id) return
        spentMap[id] = (spentMap[id] || 0) + parseFloat(t.amount)
      })

      const rows = budgets?.map(b => {
        const spent = spentMap[b.category_id] || 0
        const budgetMonthly = parseFloat(b.amount_annual) / 12
        const remaining = budgetMonthly - spent
        return {
          id: b.category_id,
          code: b.categories?.code,
          name: b.categories?.name,
          block: b.categories?.block,
          budget: budgetMonthly,
          spent,
          remaining,
        }
      }) || []

      setData(rows)
      setSummary({ totalIncome, totalSpending, totalSavings, totalRetirement, revenuCible })
      setLoading(false)
    }
    fetchData()
  }, [month, year])

  const spendingRows = data.filter(r => r.block === 'spending')
  const savingsRows = data.filter(r => r.block === 'savings')
  const retirementRows = data.filter(r => r.block === 'retirement')
  const totalSpent = spendingRows.reduce((s, r) => s + r.spent, 0)
  const totalBudget = spendingRows.reduce((s, r) => s + r.budget, 0)

  if (loading) return (
    <div className="flex items-center justify-center pt-20">
      <div className="text-slate-400 text-sm">Chargement...</div>
    </div>
  )

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-28">

      <div className="flex gap-2 mb-5">
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

      {summary && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <BlockCard label="Retraite 10%" amount={summary.totalRetirement} bg="#eff6ff" color="#1d4ed8" />
          <BlockCard label="Épargne 35%" amount={summary.totalSavings} bg="#f0fdf4" color="#15803d" />
          <BlockCard label="Dépenses 55%" amount={summary.totalSpending} bg="#fff7ed" color="#c2410c" />
        </div>
      )}

      {summary && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Revenu net du mois</span>
            <span className="font-bold text-slate-800">{summary.totalIncome.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
          </div>
          {summary.revenuCible > 0 && (
            <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-50">
              <span className="text-xs text-slate-400">Cible mensuelle</span>
              <span className={`text-xs font-semibold ${summary.totalIncome >= summary.revenuCible ? 'text-emerald-600' : 'text-red-500'}`}>
                {summary.revenuCible.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })} {summary.totalIncome >= summary.revenuCible ? '✓' : '↓'}
              </span>
            </div>
          )}
        </div>
      )}

      <SectionHeader icon="🛒" title="Dépenses (55%)">
        <span className={`text-xs font-semibold ${totalSpent > totalBudget ? 'text-red-500' : 'text-emerald-600'}`}>
          {(totalBudget - totalSpent).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })} restant
        </span>
      </SectionHeader>
      <div className="flex flex-col gap-2 mb-5">
        {spendingRows.map(r => <CategoryRow key={r.id} row={r} barColor="#f97316" />)}
        {spendingRows.length === 0 && <EmptyCard text="Aucune catégorie de dépenses" />}
      </div>

      <SectionHeader icon="💰" title="Épargne (35%)" />
      <div className="flex flex-col gap-2 mb-5">
        {savingsRows.map(r => <CategoryRow key={r.id} row={r} barColor="#10b981" />)}
        {savingsRows.length === 0 && <EmptyCard text="Aucune catégorie d'épargne" />}
      </div>

      <SectionHeader icon="🏦" title="Retraite (10%)" />
      <div className="flex flex-col gap-2">
        {retirementRows.map(r => <CategoryRow key={r.id} row={r} barColor="#3b82f6" />)}
        {retirementRows.length === 0 && <EmptyCard text="Aucune catégorie de retraite" />}
      </div>

    </div>
  )
}

function SectionHeader({ icon, title, children }) {
  return (
    <div className="flex justify-between items-center mb-2">
      <h2 className="text-sm font-semibold text-slate-600">{icon} {title}</h2>
      {children}
    </div>
  )
}

function EmptyCard({ text }) {
  return <p className="text-xs text-slate-400 text-center py-3">{text}</p>
}

function BlockCard({ label, amount, bg, color }) {
  return (
    <div style={{ background: bg, borderRadius: '16px', padding: '12px', textAlign: 'center', border: `1px solid ${color}22` }}>
      <p style={{ fontSize: '10px', fontWeight: '600', color, marginBottom: '4px', letterSpacing: '0.02em' }}>{label}</p>
      <p style={{ fontSize: '15px', fontWeight: '700', color }}>{amount.toLocaleString('fr-CA', { maximumFractionDigits: 0 })} $</p>
    </div>
  )
}

function CategoryRow({ row, barColor }) {
  const pct = row.budget > 0 ? Math.min((row.spent / row.budget) * 100, 100) : 0
  const over = row.spent > row.budget
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-700 font-medium">{row.code} — {row.name}</span>
        <span className={`text-sm font-semibold ml-2 whitespace-nowrap ${over ? 'text-red-500' : 'text-slate-700'}`}>
          {row.remaining.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div style={{
          width: `${pct}%`,
          height: '6px',
          borderRadius: '9999px',
          backgroundColor: over ? '#ef4444' : barColor,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-xs text-slate-400">{row.spent.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })} dépensé</span>
        <span className="text-xs text-slate-400">{row.budget.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })} budget</span>
      </div>
    </div>
  )
}