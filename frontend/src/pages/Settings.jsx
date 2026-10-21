import React, { useState } from 'react';
import { api } from '../api';
import { 
  Save, 
  LogOut, 
  Check, 
  AlertCircle, 
  Download,
  KeyRound,
  ShieldCheck,
  Bot
} from 'lucide-react';

export default function Settings({ 
  user, 
  settings, 
  onSaveSettings, 
  onLogout, 
  installPrompt, 
  onInstall 
}) {
  const [restaurantName, setRestaurantName] = useState(settings?.restaurantName || 'Чархпалак Чойхонаси');
  const [pinCode, setPinCode] = useState('');
  const [hasPin, setHasPin] = useState(user?.has_pin || false);
  const [loading, setLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [error, setError] = useState('');

  const isTop3 = user?.is_top3;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isTop3) return;
    setError('');
    setLoading(true);

    try {
      await onSaveSettings({ restaurantName });
      setSuccessMsg('Созламалар сақланди!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Хатолик юз берди');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePin = async (e) => {
    e.preventDefault();
    if (pinCode && pinCode.length !== 4) {
      setError('ПИН-код 4 та рақамдан иборат бўлиши керак');
      return;
    }

    setPinLoading(true);
    setError('');
    try {
      const res = await api.setPin(pinCode);
      setHasPin(res.has_pin);
      setPinMsg(res.message);
      setPinCode('');
      setTimeout(() => setPinMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'ПИН-кодни сақлашда хатолик');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-24 text-xs">
      
      <div>
        <h2 className="text-xl font-black text-blue-950 tracking-tight">
          Созламалар
        </h2>
        <p className="text-slate-500 mt-0.5">
          Шахсий хавфсизлик ва тизим параметрлари
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center space-x-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* PWA INSTALL */}
      {installPrompt && (
        <div className="bg-gradient-to-r from-blue-700 to-sky-600 rounded-2xl p-4 text-white shadow-md flex items-center justify-between">
          <div>
            <div className="font-bold text-sm">Дастурни телефонга ўрнатиш</div>
            <div className="text-[11px] text-sky-100 mt-0.5">
              Бош экранга илова сифатида қўшиш
            </div>
          </div>
          <button
            onClick={onInstall}
            className="bg-white text-blue-900 font-bold px-3 py-2 rounded-xl text-xs shadow hover:bg-blue-50 active:scale-95 transition-all flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ўрнатиш</span>
          </button>
        </div>
      )}

      {/* USER PROFILE */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Сизнинг ҳисобингиз
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-extrabold text-blue-950 text-sm">{user?.full_name}</div>
            <div className="text-slate-500 font-mono text-[11px]">{user?.phone}</div>
          </div>
          <span className="bg-blue-100 text-blue-900 font-bold px-2.5 py-1 rounded-lg">
            {user?.role_title}
          </span>
        </div>
      </div>

      {/* PERSONAL PIN CODE (PASSCODE) MANAGEMENT */}
      <form onSubmit={handleUpdatePin} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
          <KeyRound className="w-4 h-4 text-blue-700" />
          <h3 className="font-extrabold text-blue-950 text-xs uppercase tracking-wider">
            Шахсий ПИН-код (Пароль)
          </h3>
        </div>

        {pinMsg && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] font-semibold flex items-center space-x-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>{pinMsg}</span>
          </div>
        )}

        <p className="text-slate-500 text-[11px]">
          {hasPin 
            ? 'Сизда ПИН-код ўрнатилган. Янги 4 хонали код киритиб ўзгартиришингиз ёки бўш қолдириб бекор қилишингиз мумкин.'
            : 'Ҳар сафар Telegram кодни кутмасдан тез кириш учун 4 хонали ПИН-код ўрнатинг.'}
        </p>

        <div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pinCode}
            onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
            placeholder={hasPin ? "Янги ПИН-код (••••)" : "4 хонали ПИН-код"}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-black text-center tracking-[0.4em] focus:ring-2 focus:ring-blue-600 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={pinLoading}
          className="w-full bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold py-2.5 rounded-xl transition-all shadow"
        >
          {pinLoading ? 'Сақланмоқда...' : (pinCode ? 'ПИН-кодни сақлаш' : (hasPin ? 'ПИН-кодни ўчириш' : 'ПИН-код ўрнатиш'))}
        </button>
      </form>

      {/* CONNECTED TELEGRAM BOT INFO */}
      <div className="bg-white rounded-2xl p-4 border border-blue-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-blue-950 text-xs">Telegram Бот</div>
            <div className="text-[11px] text-sky-700 font-medium">@charxpalak_authbot</div>
          </div>
        </div>
        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center space-x-1">
          <Check className="w-3 h-3" />
          <span>Фаол</span>
        </span>
      </div>

      {/* RESTAURANT NAME (TOP 3) */}
      {isTop3 && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Чойхона номи
            </label>
            <input
              type="text"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-black text-white font-bold py-2 rounded-xl transition-all"
          >
            {loading ? 'Сақланмоқда...' : 'Сақлаш'}
          </button>
        </form>
      )}

      {/* LOGOUT */}
      <div className="pt-2">
        <button
          onClick={onLogout}
          className="w-full bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold py-3 rounded-2xl flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Тизимдан чиқиш (Бошқа ходим)</span>
        </button>
      </div>

    </div>
  );
}
