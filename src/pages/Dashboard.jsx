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
      setSummary({ totalIncome, totalSpending, totalSavings, totalRetirement })
      setLoading(false)
    }
    fetchData()
  }, [month, year])

  const spendingRows = data.filter(r => r.block === 'spending')
  const savingsRows = data.filter(r => r.block === 'savings')
  const retirementRows = data.filter(r => r.block === 'retirement')
  const totalSpent = spendingRows.reduce((s, r) => s + r.spent, 0)
  const totalBudget = spendingRows.reduce((s, r) => s + r.budget, 0)

  if (loading) return <div style={{ padding: '24px' }}>Chargement...</div>

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px', paddingBottom: '96px' }}>

      {/* Sélecteur mois */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px' }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>
              {new Date(2000, m - 1).toLocaleString('fr-CA', { month: 'long' })}
            </option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px' }}>
          {[2025, 2026, 2027].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Blocs 10/35/55 */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '24px' }}>
          <BlockCard label="Retraite 10%" amount={summary.totalRetirement} bg="#eff6ff" color="#1d4ed8" />
          <BlockCard label="Épargne 35%" amount={summary.totalSavings} bg="#f0fdf4" color="#15803d" />
          <BlockCard label="Dépenses 55%" amount={summary.totalSpending} bg="#fff7ed" color="#c2410c" />
        </div>
      )}

      {/* Revenu total */}
      {summary && (
        <div style={{ background: '#f3f4f6', borderRadius: '8px', padding: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>Revenu net du mois</span>
          <span style={{ fontWeight: 'bold' }}>{summary.totalIncome.toFixed(2)} $</span>
        </div>
      )}

      {/* Dépenses */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 style={{ fontWeight: 'bold', color: '#374151' }}>🛒 Dépenses (55%)</h2>
        <span style={{ fontSize: '14px', fontWeight: '500', color: totalSpent > totalBudget ? '#dc2626' : '#16a34a' }}>
          {(totalBudget - totalSpent).toFixed(2)} $ restant
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {spendingRows.map(r => <CategoryRow key={r.id} row={r} />)}
      </div>

      {/* Épargne */}
      <h2 style={{ fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>💰 Épargne (35%)</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {savingsRows.map(r => <CategoryRow key={r.id} row={r} />)}
      </div>

      {/* Retraite */}
      <h2 style={{ fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>🏦 Retraite (10%)</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {retirementRows.map(r => <CategoryRow key={r.id} row={r} />)}
      </div>

    </div>
  )
}

function BlockCard({ label, amount, bg, color }) {
  return (
    <div style={{ background: bg, borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
      <p style={{ fontSize: '11px', fontWeight: '500', color, marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '14px', fontWeight: 'bold', color }}>{amount.toFixed(0)} $</p>
    </div>
  )
}

function CategoryRow({ row }) {
  const pct = row.budget > 0 ? Math.min((row.spent / row.budget) * 100, 100) : 0
  const over = row.spent > row.budget
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '14px' }}>{row.code} — {row.name}</span>
        <span style={{ fontSize: '14px', fontWeight: '500', color: over ? '#dc2626' : '#374151', marginLeft: '8px', whiteSpace: 'nowrap' }}>
          {row.remaining.toFixed(0)} $
        </span>
      </div>
      <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px' }}>
        <div style={{
          width: `${pct}%`,
          height: '8px',
          borderRadius: '9999px',
          backgroundColor: over ? '#ef4444' : '#3b82f6'
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', color: '#9ca3af' }}>
        <span>{row.spent.toFixed(0)} $ dépensé</span>
        <span>{row.budget.toFixed(0)} $ budget</span>
      </div>
    </div>
  )
}
