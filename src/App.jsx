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

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')

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

  return (
    <div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex">
        <button onClick={() => setPage('dashboard')}
          className={`flex-1 p-3 text-xs font-medium ${page === 'dashboard' ? 'text-blue-600 border-t-2 border-blue-600' : 'text-gray-500'}`}>
          Dashboard
        </button>
        <button onClick={() => setPage('list')}
          className={`flex-1 p-3 text-xs font-medium ${page === 'list' ? 'text-blue-600 border-t-2 border-blue-600' : 'text-gray-500'}`}>
          Transactions
        </button>
        <button onClick={() => setPage('add')}
          className={`flex-1 p-3 text-xs font-medium ${page === 'add' ? 'text-blue-600 border-t-2 border-blue-600' : 'text-gray-500'}`}>
          + Dépense
        </button>
        <button onClick={() => setPage('income')}
          className={`flex-1 p-3 text-xs font-medium ${page === 'income' ? 'text-green-600 border-t-2 border-green-600' : 'text-gray-500'}`}>
          + Revenu
        </button>
        <button onClick={() => setPage('budget')}
          className={`flex-1 p-3 text-xs font-medium ${page === 'budget' ? 'text-purple-600 border-t-2 border-purple-600' : 'text-gray-500'}`}>
          Budget
        </button>
        <button onClick={() => setPage('savings')}
          className={`flex-1 p-3 text-xs font-medium ${page === 'savings' ? 'text-blue-600 border-t-2 border-blue-600' : 'text-gray-500'}`}>
          Épargne
        </button>
        <button onClick={() => setPage('networth')}
          className={`flex-1 p-3 text-xs font-medium ${page === 'networth' ? 'text-blue-600 border-t-2 border-blue-600' : 'text-gray-500'}`}>
          Net Worth
        </button>
      </div>

      <div className="pb-16">
        {page === 'dashboard' && <Dashboard />}
        {page === 'list' && <TransactionList />}
        {page === 'add' && <AddTransaction />}
        {page === 'income' && <AddIncome />}
        {page === 'budget' && <BudgetConfig />}
        {page === 'savings' && <SavingsTracking />}
        {page === 'networth' && <NetWorth />}
      </div>
    </div>
  )
}

export default App