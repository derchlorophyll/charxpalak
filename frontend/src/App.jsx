import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { playNotificationSound, requestBrowserNotification, showBrowserNotification } from './utils/sound';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import TransferModal from './components/TransferModal';
import Login from './pages/Login';
import Home from './pages/Home';
import History from './pages/History';
import Employees from './pages/Employees';
import Settings from './pages/Settings';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App data state
  const [activeTab, setActiveTab] = useState('home');
  const [transactions, setTransactions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [pendingApplicants, setPendingApplicants] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Modal state
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // PWA Install prompt state
  const [installPrompt, setInstallPrompt] = useState(null);

  // Previous pending count ref for detecting new incoming transfers in real-time
  const prevPendingCountRef = useRef(0);

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    requestBrowserNotification();
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Restore session
  useEffect(() => {
    const token = localStorage.getItem('charxpalak_token');
    if (!token) {
      setAuthLoading(false);
      return;
    }

    api.getMe()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        localStorage.removeItem('charxpalak_token');
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  // Fetch all app data
  const fetchData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const promises = [
        api.getTransactions(),
        api.getEmployees().catch(() => ({ employees: [] })),
        api.getStats().catch(() => ({})),
        api.getSettings().catch(() => ({}))
      ];

      if (user.is_top3) {
        promises.push(api.getPendingEmployees().catch(() => ({ pending: [] })));
      }

      const results = await Promise.all(promises);
      const txRes = results[0];
      const empRes = results[1];
      const statsRes = results[2];
      const setRes = results[3];
      const pendingEmpRes = user.is_top3 ? results[4] : { pending: [] };

      const allTx = txRes.transactions || [];
      setTransactions(allTx);
      setEmployees(empRes.employees || []);
      setStats(statsRes);
      setSettings(setRes);
      setPendingApplicants(pendingEmpRes?.pending || []);

      // Check incoming pending transfers for current user
      const incomingPending = allTx.filter(t => t.receiver_id === user.id && t.status === 'PENDING');
      
      // REAL-TIME IN-APP NOTIFICATION: If new transfer arrived!
      if (incomingPending.length > prevPendingCountRef.current) {
        const latest = incomingPending[0];
        playNotificationSound();
        if (latest) {
          showBrowserNotification(
            '🫖 Пул топширилди!',
            `${latest.sender_full_name} сизга ${latest.amount.toLocaleString('uz-UZ')} сўм пул берди.`
          );
        }
      }
      prevPendingCountRef.current = incomingPending.length;

    } catch (err) {
      console.error('Fetch data error:', err);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
      const interval = setInterval(fetchData, 3000);
      return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  // Actions
  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setActiveTab('home');
  };

  const handleLogout = () => {
    localStorage.removeItem('charxpalak_token');
    setUser(null);
  };

  const handleCreateTransaction = async (data) => {
    await api.createTransaction(data);
    await fetchData();
  };

  const handleConfirmTransaction = async (id) => {
    await api.confirmTransaction(id);
    await fetchData();
  };

  const handleRejectTransaction = async (id, reason) => {
    await api.rejectTransaction(id, reason);
    await fetchData();
  };

  const handleCreateEmployee = async (data) => {
    await api.createEmployee(data);
    await fetchData();
  };

  const handleUpdateEmployee = async (id, data) => {
    await api.updateEmployee(id, data);
    await fetchData();
  };

  const handleToggleEmployeeStatus = async (id) => {
    await api.toggleEmployeeStatus(id);
    await fetchData();
  };

  const handleApproveApplicant = async (id) => {
    await api.approveEmployee(id);
    await fetchData();
  };

  const handleRejectApplicant = async (id) => {
    await api.rejectEmployeeRegistration(id);
    await fetchData();
  };

  const handleSaveSettings = async (data) => {
    await api.saveSettings(data);
    await fetchData();
  };

  const pendingForMe = transactions.filter(
    (tx) => tx.receiver_id === user?.id && tx.status === 'PENDING'
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 rounded-3xl bg-white p-2 shadow-xl border-2 border-blue-200 animate-pulse flex items-center justify-center">
          <img src="/logo.png" alt="Чархпалак" className="w-full h-full object-contain" />
        </div>
        <div className="mt-4 font-black text-blue-950 text-base">Чархпалак Чойхонаси</div>
        <div className="text-xs text-slate-400 mt-1">Юкланмоқда...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      {/* Header */}
      <Header
        user={user}
        restaurantName={settings?.restaurantName}
        installPrompt={installPrompt}
        onInstall={handleInstallClick}
      />

      {/* Pages */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <Home
            user={user}
            stats={stats}
            pendingTransactions={pendingForMe}
            recentTransactions={transactions}
            onOpenTransfer={() => setIsTransferOpen(true)}
            onConfirmTx={handleConfirmTransaction}
            onRejectTx={handleRejectTransaction}
            onViewHistory={() => setActiveTab('history')}
            onViewEmployees={() => setActiveTab('employees')}
            onRefresh={fetchData}
            loading={dataLoading}
          />
        )}

        {activeTab === 'history' && (
          <History
            transactions={transactions}
            currentUser={user}
          />
        )}

        {activeTab === 'employees' && user.is_top3 && (
          <Employees
            employees={employees}
            pendingApplicants={pendingApplicants}
            currentUser={user}
            onCreateEmployee={handleCreateEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onToggleStatus={handleToggleEmployeeStatus}
            onApproveApplicant={handleApproveApplicant}
            onRejectApplicant={handleRejectApplicant}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            user={user}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onLogout={handleLogout}
            installPrompt={installPrompt}
            onInstall={handleInstallClick}
          />
        )}
      </main>

      {/* Bottom Nav */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isTop3={user.is_top3}
        pendingCount={pendingForMe.length}
        pendingStaffCount={pendingApplicants.length}
      />

      {/* Transfer Modal */}
      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        employees={employees}
        currentUser={user}
        onSubmit={handleCreateTransaction}
      />
    </div>
  );
}
