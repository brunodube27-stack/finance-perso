import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import AddTransaction from './pages/AddTransaction'
import TransactionList from './pages/TransactionList'
import AddIncome from './pages/AddIncome'
import BudgetConfig from './pages/BudgetConfig'
import Dashboard from './pages/Dashboard'
import SavingsTracking from './pages/SavingsTracking'
import NetWorth from './pages/NetWorth'
import Metaux from './pages/Metaux'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [subPage, setSubPage] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{ padding: '24px' }}>Chargement...</div>
  if (!session) return <Login />

  function navigate(p, sub = null) {
    setPage(p)
    setSubPage(sub)
  }

  function renderPage() {
    if (page === 'dashboard') return <Dashboard />
    if (page === 'add') return <AddTransaction />
    if (page === 'income') return <AddIncome />
    if (page === 'investissements') {
      const tab = subPage || 'epargne'
      return (
        <div>
          <div className="flex gap-2 p-4 border-b">
            {['epargne', 'networth', 'metaux'].map(t => (
              <button key={t} onClick={() => setSubPage(t)}
                className={`px-3 py-1 rounded-full text-sm ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                {t === 'epargne' ? 'Épargne' : t === 'networth' ? 'Net Worth' : 'Métaux'}
              </button>
            ))}
          </div>
          {tab === 'epargne' && <SavingsTracking />}
          {tab === 'networth' && <NetWorth />}
          {tab === 'metaux' && <Metaux />}
        </div>
      )
    }
    if (page === 'plus') {
      const tab = subPage || 'transactions'
      return (
        <div>
          <div className="flex gap-2 p-4 border-b">
            {['transactions', 'budget'].map(t => (
              <button key={t} onClick={() => setSubPage(t)}
                className={`px-3 py-1 rounded-full text-sm ${tab === t ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>
                {t === 'transactions' ? 'Transactions' : 'Budget'}
              </button>
            ))}
          </div>
          {tab === 'transactions' && <TransactionList />}
          {tab === 'budget' && <BudgetConfig />}
        </div>
      )
    }
  }

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', color: 'blue' },
    { key: 'add', label: '+ Dépense', color: 'red' },
    { key: 'income', label: '+ Revenu', color: 'green' },
    { key: 'investissements', label: 'Investissements', color: 'yellow' },
    { key: 'plus', label: 'Plus', color: 'gray' },
  ]

  return (
    <div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex">
        {navItems.map(({ key, label, color }) => (
          <button key={key} onClick={() => navigate(key)}
            className={`flex-1 p-3 text-xs font-medium ${page === key ? `text-${color}-600 border-t-2 border-${color}-600` : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="pb-16">
        {renderPage()}
      </div>
    </div>
  )
}

export default App