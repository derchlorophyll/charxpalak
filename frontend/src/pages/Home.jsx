import React, { useState } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Send, 
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Bell
} from 'lucide-react';

export default function Home({ 
  user, 
  stats, 
  pendingTransactions = [], 
  recentTransactions = [], 
  onOpenTransfer, 
  onConfirmTx, 
  onRejectTx,
  onViewHistory,
  onViewEmployees,
  onRefresh,
  loading 
}) {
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleConfirm = async (id) => {
    setActionLoading(true);
    try {
      await onConfirmTx(id);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingId) return;
    setActionLoading(true);
    try {
      await onRejectTx(rejectingId, rejectReason);
      setRejectingId(null);
      setRejectReason('');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-24">
      
      {/* User Welcome Card */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-sky-700 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden border border-blue-800">
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs uppercase tracking-wider font-bold text-sky-200">
              {user?.is_top3 ? '👑 Асосий Учлик (Раҳбарият)' : '🍴 Чойхона Ходими'}
            </span>
          </div>
          <button 
            onClick={onRefresh} 
            className={`text-sky-200 hover:text-white p-1 rounded-full ${loading ? 'animate-spin' : ''}`}
            title="Янгилаш"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-2 relative z-10">
          <h2 className="text-xl font-black tracking-tight">{user?.full_name}</h2>
          <div className="inline-block mt-1 bg-blue-950/60 backdrop-blur-sm border border-sky-400/30 px-2.5 py-0.5 rounded-lg text-xs font-bold text-sky-200">
            {user?.role_title}
          </div>
        </div>
      </div>

      {/* NEW EMPLOYEE APPLICANTS ALERT (FOR TOP 3) */}
      {user?.is_top3 && (stats?.pendingApplicantsCount || 0) > 0 && (
        <div 
          onClick={onViewEmployees}
          className="bg-sky-50 border-2 border-sky-300 rounded-2xl p-4 shadow-sm cursor-pointer hover:bg-sky-100 transition-all flex items-center justify-between animate-pulse"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-lg">
              👥
            </div>
            <div>
              <div className="font-extrabold text-blue-950 text-xs">
                Янги ходим қўшилиш сўрови ({stats.pendingApplicantsCount} та)
              </div>
              <div className="text-[11px] text-sky-700 font-medium">
                Тасдиқлаш ёки рад этиш учун босинг
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-sky-600" />
        </div>
      )}

      {/* PENDING APPROVALS ALERT (REAL-TIME IN-APP) */}
      {pendingTransactions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs font-black text-red-600 uppercase tracking-wider px-1">
            <Bell className="w-4 h-4 text-red-600 animate-bounce" />
            <span>ДИҚҚАТ! СИЗГА ПУЛ ТОПШИРИЛДИ ({pendingTransactions.length})</span>
          </div>

          {pendingTransactions.map((tx) => (
            <div 
              key={tx.id} 
              className="bg-red-50/95 border-2 border-red-400 rounded-3xl p-4 shadow-lg animate-in fade-in duration-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full border border-red-200">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Тасдиқлашингиз кутилмоқда</span>
                  </span>
                  <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
                    {tx.amount.toLocaleString('uz-UZ')} <span className="text-sm font-semibold text-slate-500">сўм</span>
                  </div>
                </div>
              </div>

              {/* Snapshot Identity Box */}
              <div className="mt-3 bg-white p-3 rounded-2xl border border-red-200 text-xs space-y-1.5 shadow-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Пул берувчи:</span>
                  <span className="font-bold text-slate-800 text-right">
                    {tx.sender_full_name} <span className="text-blue-700 font-semibold">({tx.sender_role_title})</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Мақсад:</span>
                  <span className="font-semibold text-slate-700">{tx.category}</span>
                </div>
                {tx.comment && (
                  <div className="flex justify-between pt-0.5 border-t border-slate-100">
                    <span className="text-slate-500">Изоҳ:</span>
                    <span className="text-slate-600 italic text-right">{tx.comment}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-3.5">
                <button
                  onClick={() => handleConfirm(tx.id)}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black py-3 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/30 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Қабул қилдим</span>
                </button>

                <button
                  onClick={() => setRejectingId(tx.id)}
                  disabled={actionLoading}
                  className="bg-white hover:bg-red-50 text-red-600 border border-red-300 font-bold py-3 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 active:scale-95 transition-all shadow-sm"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Рад этиш</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal dialog */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-sm">Тўловни рад этиш сабаби</h3>
            <p className="text-xs text-slate-500">
              Нега пулни қабул қила олмайсиз? (Масалан: Сумма кам, нотўғри ходимга берилган)
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Сабабни ёзинг..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-red-500 outline-none"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold"
              >
                Бекор қилиш
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-xs font-bold"
              >
                Рад этишни тасдиқлаш
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRIMARY ACTION: "PUL BERISH" */}
      <div>
        <button
          onClick={onOpenTransfer}
          className="w-full bg-gradient-to-r from-blue-700 to-sky-700 hover:from-blue-800 hover:to-sky-800 active:scale-[0.98] text-white font-black py-4 px-5 rounded-2xl shadow-xl shadow-blue-700/25 flex items-center justify-between transition-all border border-blue-600/30"
        >
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-2xl shadow-inner">
              💸
            </div>
            <div className="text-left">
              <div className="text-base tracking-tight leading-tight">Пул бериш (Чиқим)</div>
              <div className="text-[11px] font-medium text-sky-200">Ходимларга маблағ топшириш</div>
            </div>
          </div>
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Бугун тасдиқланган</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-black text-slate-900 mt-1.5 truncate">
            {(stats?.todayConfirmed || 0).toLocaleString('uz-UZ')}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">сўм ({stats?.todayConfirmedCount || 0} та)</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Кутилаётган</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-black text-amber-600 mt-1.5 truncate">
            {(stats?.totalPending || 0).toLocaleString('uz-UZ')}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">сўм ({stats?.totalPendingCount || 0} та)</div>
        </div>
      </div>

      {/* Total for Top 3 */}
      {user?.is_top3 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Жами тасдиқланган айланма
            </div>
            <div className="text-xl font-black text-blue-950 mt-0.5">
              {(stats?.totalConfirmed || 0).toLocaleString('uz-UZ')} <span className="text-xs text-slate-400 font-normal">сўм</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-lg">
              {stats?.totalConfirmedCount || 0} та тўлов
            </span>
          </div>
        </div>
      )}

      {/* RECENT TRANSACTIONS QUICK PREVIEW */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
            Сўнгги ўтказмалар
          </h3>
          <button
            onClick={onViewHistory}
            className="text-blue-700 hover:text-blue-800 text-xs font-bold flex items-center space-x-0.5"
          >
            <span>Барчаси</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Ҳозирча ўтказмалар мавжуд эмас
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTransactions.slice(0, 4).map((tx) => (
              <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    tx.status === 'CONFIRMED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : tx.status === 'PENDING'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {tx.status === 'CONFIRMED' ? '✓' : tx.status === 'PENDING' ? '⏳' : '✕'}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 truncate max-w-[180px]">
                      {tx.sender_full_name} → {tx.receiver_full_name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {tx.category} • {tx.sender_role_title}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-slate-900">
                    {tx.amount.toLocaleString('uz-UZ')} сўм
                  </div>
                  <div className={`text-[10px] font-semibold ${
                    tx.status === 'CONFIRMED'
                      ? 'text-emerald-600'
                      : tx.status === 'PENDING'
                      ? 'text-amber-600'
                      : 'text-red-500'
                  }`}>
                    {tx.status === 'CONFIRMED' ? 'Тасдиқланган' : tx.status === 'PENDING' ? 'Кутилмоқда' : 'Рад этилган'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
