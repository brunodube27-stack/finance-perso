import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCategories } from '../hooks/useCategories'
import { useAccounts } from '../hooks/useAccounts'
import DepensesListe from '../components/DepensesListe'

const today = new Date().toISOString().split('T')[0]

export default function AddTransaction() {
  const { categories, loading: loadingCat } = useCategories()
  const { accounts, loading: loadingAcc } = useAccounts()

  const [form, setForm] = useState({
    date: today,
    amount: '',
    type: 'expense',
    account_id: '',
    category_id: '',
    merchant: '',
    description: '',
    is_recurring: false,
  })
  const [status, setStatus] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('saving')
    const { error } = await supabase.from('transactions').insert([{
      ...form,
      amount: parseFloat(form.amount),
    }])
    if (error) {
      setStatus('error')
      console.error(error)
    } else {
      setStatus('success')
      setRefreshKey(k => k + 1)
      setForm({
        date: today,
        amount: '',
        type: 'expense',
        account_id: '',
        category_id: '',
        merchant: '',
        description: '',
        is_recurring: false,
      })
    }
  }

  if (loadingCat || loadingAcc) return (
    <div className="flex items-center justify-center pt-20">
      <div className="text-slate-400 text-sm">Chargement...</div>
    </div>
  )

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-28">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Nouvelle dépense</h1>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
              <input type="date" name="date" value={form.date} onChange={handleChange}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Montant ($)</label>
              <input type="number" name="amount" value={form.amount} onChange={handleChange}
                placeholder="0.00" step="0.01" min="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400 text-right" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
            <select name="type" value={form.type} onChange={handleChange}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
              <option value="expense">Dépense</option>
              <option value="transfer">Transfert</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Compte</label>
            <select name="account_id" value={form.account_id} onChange={handleChange}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400" required>
              <option value="">Sélectionner un compte</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catégorie</label>
            <select name="category_id" value={form.category_id} onChange={handleChange}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400" required>
              <option value="">Sélectionner une catégorie</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Marchand</label>
            <input type="text" name="merchant" value={form.merchant} onChange={handleChange}
              placeholder="Ex: IGA, Costco, Netflix"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Note</label>
            <input type="text" name="description" value={form.description} onChange={handleChange}
              placeholder="Note additionnelle"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400" />
          </div>

          <label className="flex items-center gap-3 py-1 cursor-pointer">
            <input type="checkbox" name="is_recurring" checked={form.is_recurring} onChange={handleChange}
              className="w-4 h-4 accent-indigo-600" />
            <span className="text-sm text-slate-600">Dépense récurrente</span>
          </label>

          <button type="submit"
            className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl py-3.5 font-semibold text-sm transition-colors mt-1">
            {status === 'saving' ? 'Enregistrement...' : 'Enregistrer la dépense'}
          </button>

          {status === 'success' && <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-sm text-emerald-700 text-center">✓ Transaction enregistrée</div>}
          {status === 'error' && <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-sm text-red-600 text-center">Erreur — voir console</div>}

        </form>
      </div>
      <DepensesListe refreshKey={refreshKey} />
    </div>
  )
}