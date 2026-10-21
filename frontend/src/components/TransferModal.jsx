import React, { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';

const CATEGORIES = [
  'Гўшт хариди (Қассоб)',
  'Ошхона маҳсулотлари',
  'Сабзавот ва мевалар',
  'Касса тўлдириш',
  'Ойлик маош / Аванс',
  'Коммунал / Хўжалик',
  'Бошқа харажат'
];

export default function TransferModal({ isOpen, onClose, employees = [], currentUser, onSubmit }) {
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const availableRecipients = employees.filter(e => e.id !== currentUser?.id && e.is_active === 1);

  const handleQuickAdd = (add) => {
    const current = parseInt(amount.replace(/\D/g, '') || 0, 10);
    setAmount((current + add).toString());
  };

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    setAmount(raw);
  };

  const formattedAmount = amount ? parseInt(amount, 10).toLocaleString('uz-UZ') : '0';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const numericAmount = parseInt(amount, 10);
    if (!receiverId) {
      setError('Илтимос, пулни кимга бераётганингизни танланг');
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      setError('Илтимос, тўғри сумма киритинг');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        receiver_id: parseInt(receiverId, 10),
        amount: numericAmount,
        category,
        comment
      });
      setReceiverId('');
      setAmount('');
      setComment('');
      onClose();
    } catch (err) {
      setError(err.message || 'Хатолик юз берди');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/80">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl">💸</span>
            <div>
              <h2 className="font-extrabold text-blue-950 text-base">Пул бериш (Чиқим)</h2>
              <p className="text-[11px] text-blue-700/80 font-medium">Маблағ бериш ва қабул қилувчига билдиришнома юбориш</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-sm">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Recipient select */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 text-xs uppercase tracking-wider">
              1. Кимга берилди? (Қабул қилувчи ходим)
            </label>
            <select
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-3 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-xs"
              required
            >
              <option value="">Ходимни танланг...</option>
              {availableRecipients.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.role_title})
                </option>
              ))}
            </select>
          </div>

          {/* Amount input & quick chips */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 text-xs uppercase tracking-wider">
              2. Берилган сумма (сўмда)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={amount ? parseInt(amount, 10).toLocaleString('uz-UZ') : ''}
                onChange={handleAmountChange}
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-4 pr-16 py-3 text-2xl font-black text-slate-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                СЎМ
              </span>
            </div>

            {/* Quick sum chips */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[
                { label: '+500 минг', val: 500000 },
                { label: '+1 млн', val: 1000000 },
                { label: '+3 млн', val: 3000000 },
                { label: '+5 млн', val: 5000000 },
              ].map((chip) => (
                <button
                  type="button"
                  key={chip.val}
                  onClick={() => handleQuickAdd(chip.val)}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs py-1.5 px-1.5 rounded-lg font-bold transition-colors text-center border border-blue-200/60"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category selection */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 text-xs uppercase tracking-wider">
              3. Харажат мақсади (Категория)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`text-left text-xs p-2.5 rounded-xl border font-semibold transition-all ${
                    category === cat
                      ? 'border-blue-700 bg-blue-50 text-blue-900 ring-1 ring-blue-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Comment / Note */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 text-xs uppercase tracking-wider">
              4. Изоҳ (Ихтиёрий)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Масалан: 40 кг гўшт учун нақд пул..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none text-xs"
            />
          </div>

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-black py-3.5 rounded-xl shadow-lg shadow-blue-700/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Юборилмоқда...' : `Пулни бериш (${formattedAmount} сўм)`}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
