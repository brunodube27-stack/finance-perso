import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const today = new Date().toISOString().split('T')[0]

export default function NetWorth() {
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState({})
  const [accounting, setAccounting] = useState({})
  const [form, setForm] = useState({ account_id: '', balance_real: '', date: today, note: '' })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    const { data: accs } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('block')

    setAccounts(accs || [])

    // Dernier snapshot par compte
    const { data: snaps } = await supabase
      .from('net_worth_snapshot')
      .select('*')
      .lte('date', today)
      .order('date', { ascending: false })

    const snapMap = {}
    snaps?.forEach(s => {
      if (!snapMap[s.account_id]) snapMap[s.account_id] = s
    })
    setSnapshots(snapMap)

    // Dernier solde comptable par compte
    const now = new Date()
    const { data: tracking } = await supabase
      .from('savings_tracking')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    const accMap = {}
    tracking?.forEach(t => {
      if (!accMap[t.account_id]) accMap[t.account_id] = t.balance_accounting
    })
    setAccounting(accMap)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleSaveSnapshot(e) {
    e.preventDefault()
    setSaving(true)
    setStatus(null)
    const { error } = await supabase.from('net_worth_snapshot').insert([{
      account_id: form.account_id,
      date: form.date,
      balance_real: parseFloat(form.balance_real),
      note: form.note || null,
      source: 'manuel',
    }])
    if (error) {
      setStatus('error')
      console.error(error)
    } else {
      setStatus('success')
      setForm({ account_id: '', balance_real: '', date: today, note: '' })
      await fetchData()
    }
    setSaving(false)
  }

  const spendingAccounts = accounts.filter(a => a.block === 'spending')
  const savingsAccounts = accounts.filter(a => a.block === 'savings')
  const retirementAccounts = accounts.filter(a => a.block === 'retirement')

  const totalAccounting = Object.values(accounting).reduce((s, v) => s + parseFloat(v || 0), 0)
  const totalReal = Object.values(snapshots).reduce((s, v) => s + parseFloat(v.balance_real || 0), 0)

  if (loading) return <div style={{ padding: '24px' }}>Chargement...</div>

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px', paddingBottom: '96px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Valeur nette</h1>

      {/* Totaux */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
        <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: '#15803d', marginBottom: '4px' }}>Valeur comptable</p>
          <p style={{ fontWeight: 'bold', color: '#15803d' }}>{totalAccounting.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
        <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: '#1d4ed8', marginBottom: '4px' }}>Valeur réelle</p>
          <p style={{ fontWeight: 'bold', color: '#1d4ed8' }}>{totalReal.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
      </div>

      {/* Rendement global */}
      <div style={{ background: '#f3f4f6', borderRadius: '8px', padding: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '14px', color: '#6b7280' }}>Rendement total</span>
        <span style={{ fontWeight: 'bold', color: totalReal - totalAccounting >= 0 ? '#16a34a' : '#dc2626' }}>
          {(totalReal - totalAccounting).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
        </span>
      </div>

      {/* Comptes épargne */}
      <AccountSection title="💰 Épargne" accounts={savingsAccounts} snapshots={snapshots} accounting={accounting} />
      <AccountSection title="🏦 Retraite" accounts={retirementAccounts} snapshots={snapshots} accounting={accounting} />
      <AccountSection title="🏦 Dépenses" accounts={spendingAccounts} snapshots={snapshots} accounting={accounting} />

      {/* Formulaire nouveau snapshot */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginTop: '24px' }}>
        <h2 style={{ fontWeight: 'bold', marginBottom: '12px' }}>📸 Nouveau snapshot</h2>
        <form onSubmit={handleSaveSnapshot} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <select value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
            style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px' }} required>
            <option value="">Sélectionner un compte</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <input type="date" value={form.date}
            onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
            style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px' }} required />
          <input type="number" step="0.01" placeholder="Valeur réelle ($)"
            value={form.balance_real}
            onChange={e => setForm(p => ({ ...p, balance_real: e.target.value }))}
            style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px' }} required />
          <input type="text" placeholder="Note (ex: Relevé Q1 Questrade)"
            value={form.note}
            onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
            style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px' }} />
          <button type="submit" disabled={saving}
            style={{ background: '#1d4ed8', color: 'white', borderRadius: '8px', padding: '12px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
            {saving ? 'Enregistrement...' : 'Sauvegarder snapshot'}
          </button>
          {status === 'success' && <p style={{ color: '#16a34a', textAlign: 'center' }}>✅ Snapshot enregistré</p>}
          {status === 'error' && <p style={{ color: '#dc2626', textAlign: 'center' }}>❌ Erreur</p>}
        </form>
      </div>
    </div>
  )
}

function AccountSection({ title, accounts, snapshots, accounting }) {
  if (accounts.length === 0) return null
  return (
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {accounts.map(a => {
          const snap = snapshots[a.id]
          const acc = parseFloat(accounting[a.id] || 0)
          const real = parseFloat(snap?.balance_real || 0)
          const diff = real - acc
          return (
            <div key={a.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: '500' }}>{a.name}</span>
                {snap && (
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>{snap.date}</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', fontSize: '13px' }}>
                <div>
                  <p style={{ color: '#9ca3af', fontSize: '11px' }}>Comptable</p>
                  <p style={{ fontWeight: '500' }}>{acc.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
                </div>
                <div>
                  <p style={{ color: '#9ca3af', fontSize: '11px' }}>Réel</p>
                  <p style={{ fontWeight: '500' }}>{snap ? real.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' }) : '—'}</p>
                </div>
                <div>
                  <p style={{ color: '#9ca3af', fontSize: '11px' }}>Rendement</p>
                  <p style={{ fontWeight: '500', color: diff >= 0 ? '#16a34a' : '#dc2626' }}>
                    {snap ? diff.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' }) : '—'}
                  </p>
                </div>
              </div>
              {snap?.note && <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{snap.note}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}