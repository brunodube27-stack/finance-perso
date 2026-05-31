import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const TYPES = ['chequing', 'savings', 'credit', 'loan', 'rrsp', 'tfsa', 'fhsa', 'investment', 'cash', 'other']
const BLOCKS = ['spending', 'savings', 'retirement']
const BLOCK_LABELS = { spending: 'Dépenses', savings: 'Épargne', retirement: 'Retraite' }
const BLOCK_COLORS = {
  spending: 'bg-red-50 text-red-700 border-red-100',
  savings: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  retirement: 'bg-blue-50 text-blue-700 border-blue-100',
}

const EMPTY_FORM = { name: '', type: 'chequing', block: 'spending', is_active: true }

const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400"
const selCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400"
const labelCls = "block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5"

export default function ManageComptes() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  async function fetchAccounts() {
    const { data } = await supabase.from('accounts').select('*').order('name')
    setAccounts(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAccounts() }, [])

  async function handleSaveEdit(id) {
    setSaving(true)
    setStatus(null)
    const { error } = await supabase.from('accounts').update({
      name: editForm.name,
      type: editForm.type,
      block: editForm.block,
      is_active: editForm.is_active,
    }).eq('id', id)
    if (error) { setStatus('error') } else {
      setStatus('success')
      setEditingId(null)
      await fetchAccounts()
    }
    setSaving(false)
  }

  async function handleAdd() {
    if (!addForm.name.trim()) return
    setSaving(true)
    setStatus(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('accounts').insert({
      name: addForm.name.trim(),
      type: addForm.type,
      block: addForm.block,
      is_active: addForm.is_active,
      user_id: user.id,
    })
    if (error) { setStatus('error') } else {
      setStatus('success')
      setShowAdd(false)
      setAddForm(EMPTY_FORM)
      await fetchAccounts()
    }
    setSaving(false)
  }

  async function toggleActive(account) {
    await supabase.from('accounts').update({ is_active: !account.is_active }).eq('id', account.id)
    await fetchAccounts()
  }

  if (loading) return (
    <div className="flex items-center justify-center pt-20">
      <div className="text-slate-400 text-sm">Chargement...</div>
    </div>
  )

  const activeAccounts = accounts.filter(a => a.is_active)
  const inactiveAccounts = accounts.filter(a => !a.is_active)

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-28">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-slate-800">Comptes</h1>
        <button onClick={() => { setShowAdd(v => !v); setStatus(null) }}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
          + Ajouter
        </button>
      </div>

      {showAdd && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-5">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">Nouveau compte</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>Nom du compte</label>
              <input type="text" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="Ex: Carte Visa, REER Manuvie..." className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Type</label>
                <select value={addForm.type} onChange={e => setAddForm({ ...addForm, type: e.target.value })} className={selCls}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Bloc</label>
                <select value={addForm.block} onChange={e => setAddForm({ ...addForm, block: e.target.value })} className={selCls}>
                  {BLOCKS.map(b => <option key={b} value={b}>{BLOCK_LABELS[b]}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={handleAdd} disabled={saving || !addForm.name.trim()}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${addForm.name.trim() ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                {saving ? 'Ajout...' : 'Créer le compte'}
              </button>
              <button onClick={() => { setShowAdd(false); setAddForm(EMPTY_FORM) }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'success' && <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 text-sm text-emerald-700 text-center mb-4">✓ Sauvegardé</div>}
      {status === 'error' && <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-sm text-red-600 text-center mb-4">Erreur — voir console</div>}

      <div className="flex flex-col gap-2 mb-5">
        {activeAccounts.map(a => (
          <AccountCard key={a.id} account={a}
            editing={editingId === a.id}
            editForm={editForm}
            onEdit={() => { setEditingId(a.id); setEditForm({ name: a.name, type: a.type || '', block: a.block || 'spending', is_active: a.is_active }) }}
            onCancel={() => setEditingId(null)}
            onSave={() => handleSaveEdit(a.id)}
            onToggle={() => toggleActive(a)}
            onChange={setEditForm}
            saving={saving}
          />
        ))}
        {activeAccounts.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Aucun compte actif</p>}
      </div>

      {inactiveAccounts.length > 0 && (
        <>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Comptes inactifs</p>
          <div className="flex flex-col gap-2">
            {inactiveAccounts.map(a => (
              <AccountCard key={a.id} account={a}
                editing={editingId === a.id}
                editForm={editForm}
                onEdit={() => { setEditingId(a.id); setEditForm({ name: a.name, type: a.type || '', block: a.block || 'spending', is_active: a.is_active }) }}
                onCancel={() => setEditingId(null)}
                onSave={() => handleSaveEdit(a.id)}
                onToggle={() => toggleActive(a)}
                onChange={setEditForm}
                saving={saving}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function AccountCard({ account, editing, editForm, onEdit, onCancel, onSave, onToggle, onChange, saving }) {
  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-4">
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Nom</label>
            <input type="text" value={editForm.name} onChange={e => onChange({ ...editForm, name: e.target.value })}
              className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Type</label>
              <select value={editForm.type} onChange={e => onChange({ ...editForm, type: e.target.value })} className={selCls}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Bloc</label>
              <select value={editForm.block} onChange={e => onChange({ ...editForm, block: e.target.value })} className={selCls}>
                {BLOCKS.map(b => <option key={b} value={b}>{BLOCK_LABELS[b]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id={`active-${account.id}`} checked={editForm.is_active}
              onChange={e => onChange({ ...editForm, is_active: e.target.checked })}
              className="w-4 h-4 accent-indigo-600" />
            <label htmlFor={`active-${account.id}`} className="text-sm text-slate-600">Compte actif</label>
          </div>
          <div className="flex gap-2">
            <button onClick={onSave} disabled={saving}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            <button onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 ${!account.is_active ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-800">{account.name}</span>
            {account.type && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{account.type}</span>}
            {account.block && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${BLOCK_COLORS[account.block] || 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                {BLOCK_LABELS[account.block] || account.block}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button onClick={onEdit}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={onToggle} title={account.is_active ? 'Désactiver' : 'Activer'}
            className={`p-1.5 rounded-lg transition-colors ${account.is_active ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
            {account.is_active
              ? <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 7 7 17M7 7l10 10"/></svg>
              : <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
