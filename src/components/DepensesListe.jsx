import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useCategories } from '../hooks/useCategories'
import { useAccounts } from '../hooks/useAccounts'

const fmt = (n) => parseFloat(n || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })
const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400"
const labelCls = "block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1"

const now = new Date()

export default function DepensesListe({ refreshKey }) {
  const { categories } = useCategories()
  const { accounts } = useAccounts()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function load() {
    setLoading(true)
    const mm = String(month).padStart(2, '0')
    const lastDay = new Date(year, month, 0).getDate()
    const { data } = await supabase
      .from('transactions')
      .select('*, categories(code, name), accounts(name)')
      .gte('date', `${year}-${mm}-01`)
      .lte('date', `${year}-${mm}-${lastDay}`)
      .order('date', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [month, year, refreshKey])

  function startEdit(t) {
    setEditId(t.id)
    setEditForm({
      date: t.date, amount: t.amount, type: t.type,
      account_id: t.account_id || '', category_id: t.category_id || '',
      merchant: t.merchant || '', description: t.description || '',
      is_recurring: t.is_recurring || false,
    })
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await supabase.from('transactions').update({
      ...editForm,
      amount: parseFloat(editForm.amount),
    }).eq('id', editId)
    if (!error) { setEditId(null); await load() }
    setSaving(false)
  }

  async function deleteItem(id) {
    await supabase.from('transactions').delete().eq('id', id)
    setConfirmDelete(null)
    await load()
  }

  const total = items.reduce((s, t) => s + parseFloat(t.amount || 0), 0)

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-700">Dépenses du mois</h2>
        <div className="flex gap-1.5">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('fr-CA', { month: 'short' })}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-2.5 mb-3 flex justify-between items-center">
        <span className="text-xs text-slate-500">{items.length} transaction{items.length !== 1 ? 's' : ''}</span>
        <span className="font-bold text-sm text-red-500">{fmt(total)}</span>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-sm">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">Aucune dépense ce mois-ci</div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm">
              {editId === t.id ? (
                <div className="p-4 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>Date</label>
                      <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className={inputCls} /></div>
                    <div><label className={labelCls}>Montant ($)</label>
                      <input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} className={`${inputCls} text-right`} /></div>
                  </div>
                  <div><label className={labelCls}>Marchand</label>
                    <input type="text" value={editForm.merchant} onChange={e => setEditForm({...editForm, merchant: e.target.value})} className={inputCls} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>Compte</label>
                      <select value={editForm.account_id} onChange={e => setEditForm({...editForm, account_id: e.target.value})} className={inputCls}>
                        <option value="">—</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select></div>
                    <div><label className={labelCls}>Catégorie</label>
                      <select value={editForm.category_id} onChange={e => setEditForm({...editForm, category_id: e.target.value})} className={inputCls}>
                        <option value="">—</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                      </select></div>
                  </div>
                  <div><label className={labelCls}>Note</label>
                    <input type="text" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className={inputCls} /></div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={editForm.is_recurring} onChange={e => setEditForm({...editForm, is_recurring: e.target.checked})} className="w-4 h-4 accent-indigo-600" />
                    <span className="text-slate-600">Récurrente</span>
                  </label>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
                      {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-sm font-medium transition-colors">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 flex justify-between items-start">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="font-medium text-sm text-slate-800 truncate">{t.merchant || t.description || '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t.categories?.code} — {t.categories?.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.accounts?.name} · {t.date}{t.is_recurring ? ' · 🔁' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-semibold text-sm text-red-500 mr-2">{fmt(t.amount)}</span>
                    <button onClick={() => startEdit(t)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    {confirmDelete === t.id ? (
                      <>
                        <button onClick={() => deleteItem(t.id)}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors">Suppr.</button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Non</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDelete(t.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
