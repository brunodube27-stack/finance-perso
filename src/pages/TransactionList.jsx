import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useCategories } from '../hooks/useCategories'
import { useAccounts } from '../hooks/useAccounts'

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

const fmt = (n) => parseFloat(n || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })
const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400"
const labelCls = "block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1"

function MonthYearPicker({ month, year, onMonth, onYear }) {
  return (
    <div className="flex gap-2 mb-4">
      <select value={month} onChange={e => onMonth(Number(e.target.value))}
        className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
          <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('fr-CA', { month: 'long' })}</option>
        ))}
      </select>
      <select value={year} onChange={e => onYear(Number(e.target.value))}
        className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}

// ─── Dépenses ─────────────────────────────────────────────────────────────────

function DepensesTab({ month, year }) {
  const { categories } = useCategories()
  const { accounts } = useAccounts()
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

  useEffect(() => { load() }, [month, year])

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

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Chargement...</div>

  return (
    <div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 mb-3 flex justify-between items-center">
        <span className="text-sm text-slate-500">Total dépenses</span>
        <span className="font-bold text-red-500">{fmt(total)}</span>
      </div>

      {items.length === 0
        ? <div className="text-center py-12 text-slate-400 text-sm">Aucune dépense ce mois-ci</div>
        : <div className="flex flex-col gap-2">
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
      }
    </div>
  )
}

// ─── Revenus ──────────────────────────────────────────────────────────────────

function RevenusTab({ month, year }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [split, setSplit] = useState({ retirement: 10, savings: 35, spending: 55 })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function load() {
    setLoading(true)
    const mm = String(month).padStart(2, '0')
    const lastDay = new Date(year, month, 0).getDate()
    const { data } = await supabase
      .from('income')
      .select('*')
      .gte('date', `${year}-${mm}-01`)
      .lte('date', `${year}-${mm}-${lastDay}`)
      .order('date', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const today = new Date().toISOString().split('T')[0]
    supabase.from('split_config').select('*').lte('valid_from', today).order('valid_from', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setSplit({ retirement: data[0].pct_retirement, savings: data[0].pct_savings, spending: data[0].pct_spending }) })
  }, [month, year])

  function startEdit(inc) {
    setEditId(inc.id)
    setEditForm({
      date: inc.date, amount: inc.amount, type: inc.type || 'variable',
      source: inc.source || '', description: inc.description || '',
      employer_contribution: inc.employer_contribution || '',
      employer_contribution_note: inc.employer_contribution_note || '',
    })
  }

  async function saveEdit() {
    setSaving(true)
    const amt = parseFloat(editForm.amount)
    const { error } = await supabase.from('income').update({
      date: editForm.date, amount: amt, type: editForm.type,
      source: editForm.source, description: editForm.description,
      split_retirement: amt * split.retirement / 100,
      split_savings: amt * split.savings / 100,
      split_spending: amt * split.spending / 100,
      employer_contribution: editForm.employer_contribution ? parseFloat(editForm.employer_contribution) : 0,
      employer_contribution_note: editForm.employer_contribution_note || null,
    }).eq('id', editId)
    if (!error) { setEditId(null); await load() }
    setSaving(false)
  }

  async function deleteItem(id) {
    await supabase.from('income').delete().eq('id', id)
    setConfirmDelete(null)
    await load()
  }

  const total = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0)

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Chargement...</div>

  return (
    <div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 mb-3 flex justify-between items-center">
        <span className="text-sm text-slate-500">Total revenus</span>
        <span className="font-bold text-emerald-600">{fmt(total)}</span>
      </div>

      {items.length === 0
        ? <div className="text-center py-12 text-slate-400 text-sm">Aucun revenu ce mois-ci</div>
        : <div className="flex flex-col gap-2">
            {items.map(inc => (
              <div key={inc.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm">
                {editId === inc.id ? (
                  <div className="p-4 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={labelCls}>Date</label>
                        <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className={inputCls} /></div>
                      <div><label className={labelCls}>Montant net ($)</label>
                        <input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} className={`${inputCls} text-right`} /></div>
                    </div>
                    {editForm.amount > 0 && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-xs text-slate-600 flex gap-3">
                        <span>Retraite {fmt(parseFloat(editForm.amount) * split.retirement / 100)}</span>
                        <span>Épargne {fmt(parseFloat(editForm.amount) * split.savings / 100)}</span>
                        <span>Dépenses {fmt(parseFloat(editForm.amount) * split.spending / 100)}</span>
                      </div>
                    )}
                    <div><label className={labelCls}>Source</label>
                      <input type="text" value={editForm.source} onChange={e => setEditForm({...editForm, source: e.target.value})} className={inputCls} /></div>
                    <div><label className={labelCls}>Type</label>
                      <select value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})} className={inputCls}>
                        <option value="fixed">Fixe</option>
                        <option value="variable">Variable</option>
                      </select></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={labelCls}>Contrib. employeur ($)</label>
                        <input type="number" step="0.01" value={editForm.employer_contribution} onChange={e => setEditForm({...editForm, employer_contribution: e.target.value})} className={`${inputCls} text-right`} /></div>
                      <div><label className={labelCls}>Note contrib.</label>
                        <input type="text" value={editForm.employer_contribution_note} onChange={e => setEditForm({...editForm, employer_contribution_note: e.target.value})} className={inputCls} /></div>
                    </div>
                    <div><label className={labelCls}>Description</label>
                      <input type="text" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className={inputCls} /></div>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={saving}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors">
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
                      <p className="font-medium text-sm text-slate-800 truncate">{inc.source || '—'}</p>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">{inc.type}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{inc.date}{inc.description ? ` · ${inc.description}` : ''}</p>
                      {inc.employer_contribution > 0 && (
                        <p className="text-xs text-blue-500 mt-0.5">+ {fmt(inc.employer_contribution)} employeur</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-semibold text-sm text-emerald-600 mr-2">{fmt(inc.amount)}</span>
                      <button onClick={() => startEdit(inc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      {confirmDelete === inc.id ? (
                        <>
                          <button onClick={() => deleteItem(inc.id)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors">Suppr.</button>
                          <button onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Non</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(inc.id)}
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
      }
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TransactionList() {
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)
  const [tab, setTab] = useState('depenses')

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-28">
      <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />

      <div className="flex gap-2 mb-4">
        {[['depenses', 'Dépenses', 'text-red-600'], ['revenus', 'Revenus', 'text-emerald-600']].map(([key, label, color]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border ${
              tab === key
                ? key === 'depenses' ? 'bg-red-500 text-white border-red-500' : 'bg-emerald-600 text-white border-emerald-600'
                : `bg-white ${color} border-slate-200 hover:bg-slate-50`
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'depenses' && <DepensesTab month={month} year={year} />}
      {tab === 'revenus' && <RevenusTab month={month} year={year} />}
    </div>
  )
}