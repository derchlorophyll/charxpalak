import React, { useState } from 'react';
import { 
  Search, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Lock
} from 'lucide-react';

export default function History({ transactions = [], currentUser }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = transactions.filter((tx) => {
    if (statusFilter !== 'ALL' && tx.status !== statusFilter) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchSender = tx.sender_full_name?.toLowerCase().includes(term);
      const matchReceiver = tx.receiver_full_name?.toLowerCase().includes(term);
      const matchSenderRole = tx.sender_role_title?.toLowerCase().includes(term);
      const matchReceiverRole = tx.receiver_role_title?.toLowerCase().includes(term);
      const matchCategory = tx.category?.toLowerCase().includes(term);
      const matchComment = tx.comment?.toLowerCase().includes(term);
      const matchAmount = tx.amount?.toString().includes(term);
      return matchSender || matchReceiver || matchSenderRole || matchReceiverRole || matchCategory || matchComment || matchAmount;
    }

    return true;
  });

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-24">
      
      <div>
        <h2 className="text-xl font-black text-blue-950 tracking-tight">
          Пул ҳаракати тарихи
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Барча чиқим ва кирим операциялари
        </p>
      </div>

      {/* Immutable History Guarantee Banner in Cyrillic */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 text-xs text-blue-950 flex items-start space-x-2.5 shadow-sm">
        <Lock className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
        <div className="leading-relaxed">
          <span className="font-bold">Ўчмас тарих кафолати:</span> Ходим алмашса ҳам, ўтмишдаги барча тўловларда ходимнинг ўша пайтдаги фамилияси ва лавозими дахлсиз сақланади.
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Исм, лавозим ёки мақсад бўйича қидириш..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none shadow-sm"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
      </div>

      {/* Status Filter Chips */}
      <div className="flex space-x-1.5 overflow-x-auto no-scrollbar py-1">
        {[
          { id: 'ALL', label: 'Барчаси' },
          { id: 'CONFIRMED', label: 'Тасдиқланган' },
          { id: 'PENDING', label: 'Кутилмоқда' },
          { id: 'REJECTED', label: 'Рад этилган' },
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={() => setStatusFilter(btn.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === btn.id
                ? 'bg-blue-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>Топилди: <b>{filtered.length}</b> та транзакция</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80">
          <div className="text-3xl mb-2">🔍</div>
          <div className="text-sm font-semibold text-slate-700">Транзакциялар топилмади</div>
          <p className="text-xs text-slate-400 mt-1">
            Қидирув сўзини ўзгартириб кўринг ёки фильтрларни тозаланг
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tx) => {
            const isConfirmed = tx.status === 'CONFIRMED';
            const isPending = tx.status === 'PENDING';
            const isRejected = tx.status === 'REJECTED';

            return (
              <div
                key={tx.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400">Сумма:</span>
                    <div className="text-xl font-black text-slate-900 tracking-tight">
                      {tx.amount.toLocaleString('uz-UZ')} <span className="text-xs font-bold text-slate-500">сўм</span>
                    </div>
                  </div>

                  <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    isConfirmed
                      ? 'bg-emerald-100 text-emerald-800'
                      : isPending
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {isConfirmed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    {isPending && <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />}
                    {isRejected && <XCircle className="w-3.5 h-3.5 text-red-600" />}
                    <span>{isConfirmed ? 'Тасдиқланган' : isPending ? 'Кутилмоқда' : 'Рад этилган'}</span>
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-2 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Берувчи:</span>
                    <span className="font-bold text-slate-800 text-right">
                      {tx.sender_full_name} <span className="text-blue-700 font-semibold">({tx.sender_role_title})</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                    <span className="text-slate-500">Олувчи:</span>
                    <span className="font-bold text-slate-800 text-right">
                      {tx.receiver_full_name} <span className="text-blue-700 font-semibold">({tx.receiver_role_title})</span>
                    </span>
                  </div>
                </div>

                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Харажат мақсади:</span>
                    <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      {tx.category}
                    </span>
                  </div>
                  {tx.comment && (
                    <div className="flex items-baseline justify-between pt-0.5">
                      <span className="text-slate-500">Изоҳ:</span>
                      <span className="text-slate-600 italic text-right max-w-[220px]">{tx.comment}</span>
                    </div>
                  )}
                  {isRejected && tx.reject_reason && (
                    <div className="p-2 bg-red-50 rounded-lg text-red-700 text-[11px] font-medium border border-red-200">
                      Рад этиш сабаби: {tx.reject_reason}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2.5">
                  <span>
                    📅 {new Date(tx.created_at).toLocaleString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {tx.confirmed_at && (
                    <span className="text-emerald-700 font-bold">
                      ✓ {new Date(tx.confirmed_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} да қабул қилинди
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
