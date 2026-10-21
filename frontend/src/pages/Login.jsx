import React, { useState } from 'react';
import { api } from '../api';
import { Phone, User, Briefcase, ArrowRight, ShieldCheck, Lock, KeyRound, AlertCircle, Crown, ArrowLeft } from 'lucide-react';

const ROLES_LIST = [
  { id: 'CASHIER', title: 'Кассир' },
  { id: 'BUTCHER', title: 'Қассоб' },
  { id: 'HEAD_CHEF', title: 'Бош ошпаз' },
  { id: 'SHASHLIK_CHEF', title: 'Шашликчи ошпаз' },
  { id: 'SOMSA_CHEF', title: 'Сомсапаз' },
  { id: 'COOK', title: 'Ошпаз' },
  { id: 'SUPPLIER', title: 'Таъминотчи (Харидчи)' },
  { id: 'DISHWASHER', title: 'Идиш ювувчи' },
  { id: 'CUSTOM', title: 'Бошқа лавозим...' },
];

export default function Login({ onLoginSuccess }) {
  // Views: 'phone' | 'pin' | 'otp' | 'set_pin' | 'unregistered_choice' | 'claim_leader' | 'register' | 'pending_notice'
  const [view, setView] = useState('phone');
  const [phone, setPhone] = useState('+998');
  const [fullName, setFullName] = useState('');
  const [roleId, setRoleId] = useState('CASHIER');
  const [customRoleTitle, setCustomRoleTitle] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [telegramLink, setTelegramLink] = useState('');
  const [pendingUser, setPendingUser] = useState(null);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Leadership claim state
  const [unboundLeaders, setUnboundLeaders] = useState([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [claimOtpRequested, setClaimOtpRequested] = useState(false);
  const [claimOtpCode, setClaimOtpCode] = useState('');

  const handlePhoneFormat = (val) => {
    let cleaned = val.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+998')) {
      if (cleaned.startsWith('998')) cleaned = '+' + cleaned;
      else cleaned = '+998' + cleaned.replace(/^\+/, '');
    }
    setPhone(cleaned);
  };

  // Step 1: Check Phone Number
  const handleCheckPhone = async (e) => {
    e?.preventDefault();
    setError('');

    if (phone.length < 13) {
      setError('Илтимос, тўлиқ телефон рақамингизни киритинг (+998...)');
      return;
    }

    setLoading(true);
    try {
      const res = await api.sendOtp(phone);

      if (res.notRegistered) {
        if (res.unboundLeaders && res.unboundLeaders.length > 0) {
          setUnboundLeaders(res.unboundLeaders);
          setSelectedLeaderId(String(res.unboundLeaders[0].id));
          setView('unregistered_choice');
        } else {
          setView('register');
        }
        return;
      }

      if (res.isPendingApproval) {
        setPendingUser(res.user);
        setView('pending_notice');
        return;
      }

      setPendingUser(res.user);
      setTelegramLink(res.telegramLink);

      // If user already has PIN, prompt for PIN first
      if (res.hasPinCode) {
        setView('pin');
      } else {
        setView('otp');
      }
    } catch (err) {
      setError(err.message || 'Хатолик юз берди');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Login with 4-digit PIN Code
  const handleVerifyPin = async (e) => {
    e?.preventDefault();
    setError('');

    if (pin.length !== 4) {
      setError('4 хонали ПИН-кодни киритинг');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyPin(phone, pin);
      localStorage.setItem('charxpalak_token', res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message || 'ПИН-код нотўғри');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify OTP from Telegram
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    setError('');

    if (!code || code.length < 4) {
      setError('4 хонали тасдиқлаш кодини киритинг');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyOtp(phone, code);
      localStorage.setItem('charxpalak_token', res.token);

      if (!res.hasPinCode) {
        setAuthenticatedUser(res.user);
        setView('set_pin');
      } else {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError(err.message || 'Код нотўғри ёки муддати тугаган');
    } finally {
      setLoading(false);
    }
  };

  // Request OTP switch from PIN view
  const handleSwitchToOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.sendOtp(phone);
      setTelegramLink(res.telegramLink);
      setView('otp');
    } catch (err) {
      setError(err.message || 'Код юборишда хатолик');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Set or Skip PIN Code
  const handleSavePin = async (e) => {
    e?.preventDefault();
    if (newPin.length !== 4) {
      setError('ПИН-код роппа-роса 4 та рақамдан иборат бўлиши керак');
      return;
    }

    setLoading(true);
    try {
      await api.setPin(newPin);
      onLoginSuccess(authenticatedUser);
    } catch (err) {
      setError(err.message || 'Хатолик юз берди');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPin = () => {
    onLoginSuccess(authenticatedUser);
  };

  // Step 5: Regular Employee Registration
  const handleRegister = async (e) => {
    e?.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Илтимос, исм ва фамилиянгизни киритинг');
      return;
    }

    const selectedRole = ROLES_LIST.find(r => r.id === roleId);
    const finalRoleTitle = roleId === 'CUSTOM' ? customRoleTitle.trim() : (selectedRole?.title || 'Ходим');

    if (roleId === 'CUSTOM' && !customRoleTitle.trim()) {
      setError('Илтимос, лавозимингиз номини ёзинг');
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        phone,
        full_name: fullName.trim(),
        role_id: roleId,
        role_title: finalRoleTitle
      });

      setPendingUser(res.user);
      setView('pending_notice');
    } catch (err) {
      setError(err.message || 'Рўйхатдан ўтишда хатолик юз берди');
    } finally {
      setLoading(false);
    }
  };

  // Step 6: Leadership Claim (One-time secure binding with Master Key & Phone OTP)
  const handleRequestClaimOtp = async (e) => {
    e?.preventDefault();
    setError('');

    if (!masterKey.trim()) {
      setError('Илтимос, Раҳбарият махсус кодини киритинг');
      return;
    }

    setLoading(true);
    try {
      const res = await api.claimLeader({
        leaderId: parseInt(selectedLeaderId, 10),
        phone,
        masterKey: masterKey.trim()
      });

      setTelegramLink(res.telegramLink);
      setClaimOtpRequested(true);
    } catch (err) {
      setError(err.message || 'Хатолик юз берди');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmClaimOtp = async (e) => {
    e?.preventDefault();
    setError('');

    if (!claimOtpCode || claimOtpCode.length < 4) {
      setError('4 хонали тасдиқлаш кодини киритинг');
      return;
    }

    setLoading(true);
    try {
      const res = await api.claimLeader({
        leaderId: parseInt(selectedLeaderId, 10),
        phone,
        masterKey: masterKey.trim(),
        code: claimOtpCode.trim()
      });

      localStorage.setItem('charxpalak_token', res.token);
      setAuthenticatedUser(res.user);
      setView('set_pin');
    } catch (err) {
      setError(err.message || 'Код нотўғри ёки муддати тугаган');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900/10 via-sky-50 to-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto">
      
      {/* Brand Header */}
      <div className="pt-6 text-center">
        <div className="w-24 h-24 mx-auto rounded-3xl bg-white p-2 shadow-xl shadow-blue-900/15 mb-3 border-2 border-blue-100 flex items-center justify-center">
          <img 
            src="/logo.png" 
            alt="Чархпалак" 
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-2xl font-black text-blue-950 tracking-tight">
          Чархпалак Чойхонаси
        </h1>
        <p className="text-xs text-blue-700/80 font-medium mt-0.5">
          Ходимлар ва пул ҳаракати тизими
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl p-6 shadow-xl border border-blue-100/80 my-4">
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center space-x-2 animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. ENTER PHONE */}
        {view === 'phone' && (
          <form onSubmit={handleCheckPhone} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Телефон рақамингиз
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => handlePhoneFormat(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-semibold text-base focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                  required
                />
                <Phone className="w-5 h-5 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Ҳар бир ходим (шу жумладан раҳбарият) ўз телефон рақами орқали тизимга киради.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-700/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span>{loading ? 'Текширилмоқда...' : 'Давом этиш'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* 2. UNREGISTERED CHOICE (EMPLOYEE OR LEADERSHIP ACTIVATION) */}
        {view === 'unregistered_choice' && (
          <div className="space-y-3.5">
            <div className="text-center pb-1">
              <h3 className="font-extrabold text-blue-950 text-base">Телефон рўйхатдан ўтмаган</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{phone}</p>
            </div>

            <p className="text-xs text-slate-600 text-center">
              Сиз қандай сифатда дастурга қўшилмоқчисиз?
            </p>

            <button
              type="button"
              onClick={() => setView('register')}
              className="w-full p-3.5 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 rounded-2xl text-left flex items-center space-x-3 transition-all active:scale-98"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center text-lg flex-shrink-0">
                🍴
              </div>
              <div>
                <div className="font-extrabold text-blue-950 text-xs">Чойхона ходими сифатида ариза бериш</div>
                <div className="text-[11px] text-blue-700/80">Кассир, Ошпаз, Қассоб, ва б.</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setView('claim_leader')}
              className="w-full p-3.5 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-300 rounded-2xl text-left flex items-center space-x-3 transition-all active:scale-98"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg flex-shrink-0">
                👑
              </div>
              <div>
                <div className="font-extrabold text-amber-950 text-xs">Раҳбарият аккаунтини улаш</div>
                <div className="text-[11px] text-amber-800">Каюмов Ж., Басиржонов Ж., Паҳлавон</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setView('phone'); setError(''); }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 py-1"
            >
              Бошқа рақам киритиш
            </button>
          </div>
        )}

        {/* 3. CLAIM LEADERSHIP ACCOUNT (ONE-TIME SECURE BINDING) */}
        {view === 'claim_leader' && (
          <div className="space-y-4">
            <div className="text-center pb-1">
              <div className="w-12 h-12 mx-auto bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mb-2 border border-amber-200">
                <Crown className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-blue-950 text-base">Раҳбарият аккаунтини улаш</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Рақамингизни ({phone}) раҳбарият профилига бириктириш
              </p>
            </div>

            {!claimOtpRequested ? (
              <form onSubmit={handleRequestClaimOtp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Сиз қайси раҳбарсиз?
                  </label>
                  <select
                    value={selectedLeaderId}
                    onChange={(e) => setSelectedLeaderId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    {unboundLeaders.map((ldr) => (
                      <option key={ldr.id} value={ldr.id}>
                        {ldr.full_name} — {ldr.role_title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Раҳбарият махсус коди
                  </label>
                  <input
                    type="password"
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    placeholder="Масалан: 7777"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    (Ушбу код фақат чойхона эгасига маълум. Стандарт код: <b>7777</b>)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-700/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <span>{loading ? 'Юборилмоқда...' : 'Тасдиқлаш кодини олиш'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => { setView('phone'); setError(''); }}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-800 py-1"
                >
                  Ортга қайтиш
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmClaimOtp} className="space-y-4">
                <div className="text-center text-xs text-slate-600 leading-relaxed">
                  Тасдиқлаш коди Telegram ботингизга юборилди.
                </div>

                {telegramLink && (
                  <a
                    href={telegramLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center space-x-2 bg-sky-500 hover:bg-sky-600 text-white py-3 px-4 rounded-2xl font-bold text-xs shadow-md transition-all active:scale-98"
                  >
                    <span>✈️ @charxpalak_authbot ни очиш</span>
                  </a>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                    4 хонали тасдиқлаш коди
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={claimOtpCode}
                    onChange={(e) => setClaimOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="0000"
                    autoFocus
                    className="w-full text-center tracking-[0.5em] py-3 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-black text-2xl focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-700/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <span>{loading ? 'Тасдиқланмоқда...' : 'Рақамни боғлаш ва кириш'}</span>
                  <ShieldCheck className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* 4. ENTER PERSONAL PIN CODE */}
        {view === 'pin' && (
          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div className="text-center pb-1">
              <div className="w-12 h-12 mx-auto bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mb-2 border border-blue-200">
                <Lock className="w-6 h-6" />
              </div>
              <div className="font-extrabold text-slate-900 text-base">{pendingUser?.full_name}</div>
              <div className="text-xs text-blue-700 font-semibold">{pendingUser?.role_title}</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                4 хонали ПИН-кодингиз
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                autoFocus
                className="w-full text-center tracking-[0.5em] py-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-black text-2xl focus:ring-2 focus:ring-blue-600 outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-700/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span>{loading ? 'Текширилмоқда...' : 'Кириш'}</span>
              <ShieldCheck className="w-4 h-4" />
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleSwitchToOtp}
                disabled={loading}
                className="text-xs text-blue-700 hover:underline font-semibold"
              >
                ПИН-кодни унутдингизми? Telegram бот орқали кириш
              </button>
            </div>
          </form>
        )}

        {/* 5. ENTER TELEGRAM OTP CODE */}
        {view === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-center pb-1">
              <div className="font-extrabold text-slate-900 text-base">{pendingUser?.full_name}</div>
              <div className="text-xs text-blue-700 font-semibold">{pendingUser?.role_title}</div>
              <p className="text-xs text-slate-500 mt-1">
                Тасдиқлаш коди Telegram ботингизга юборилди
              </p>
            </div>

            {/* Link to Official Telegram Bot */}
            {telegramLink && (
              <a
                href={telegramLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center space-x-2 bg-sky-500 hover:bg-sky-600 text-white py-3 px-4 rounded-2xl font-bold text-xs shadow-md transition-all active:scale-98"
              >
                <span>✈️ @charxpalak_authbot ни очиш</span>
              </a>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                4 хонали тасдиқлаш коди
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                autoFocus
                className="w-full text-center tracking-[0.5em] py-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-black text-2xl focus:ring-2 focus:ring-blue-600 outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-700/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span>{loading ? 'Тасдиқланмоқда...' : 'Дастурга кириш'}</span>
              <ShieldCheck className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => { setView('phone'); setCode(''); }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 py-1"
            >
              Бошқа рақам киритиш
            </button>
          </form>
        )}

        {/* 6. OPTIONAL SET PIN CODE (WITH SKIP BUTTON!) */}
        {view === 'set_pin' && (
          <form onSubmit={handleSavePin} className="space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mb-2 border border-blue-200">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">ПИН-код (пароль) ўрнатиш</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Кейинги сафар ҳар сафар код кутмасдан тез кириш учун 4 хонали шахсий ПИН-код ўрнатинг
              </p>
            </div>

            <div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                autoFocus
                className="w-full text-center tracking-[0.5em] py-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-black text-2xl focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={loading || newPin.length !== 4}
                className="w-full bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-700/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-40"
              >
                <span>ПИН-кодни сақлаш</span>
              </button>

              <button
                type="button"
                onClick={handleSkipPin}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition-colors"
              >
                Ўтказиб юбориш (Кейинроқ қўяман)
              </button>
            </div>
          </form>
        )}

        {/* 7. REGISTRATION */}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="text-center pb-1">
              <h3 className="font-extrabold text-blue-950 text-base">Янги ходим рўйхатдан ўтиши</h3>
              <p className="text-xs text-slate-500">Маълумотларингизни киритиб ариза юборинг</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Телефон рақамингиз
              </label>
              <input
                type="text"
                disabled
                value={phone}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Фамилия ва Исмингиз
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Масалан: Каримов Жасур"
                  autoFocus
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Лавозимингиз
              </label>
              <div className="relative">
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  {ROLES_LIST.map((r) => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {roleId === 'CUSTOM' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Лавозим номини ёзинг
                </label>
                <input
                  type="text"
                  value={customRoleTitle}
                  onChange={(e) => setCustomRoleTitle(e.target.value)}
                  placeholder="Масалан: Сомса устаси"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-700/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span>{loading ? 'Юборилмоқда...' : 'Аризани юбориш'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => { setView('phone'); setError(''); }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 py-1"
            >
              Ортга қайтиш
            </button>
          </form>
        )}

        {/* 8. PENDING APPROVAL NOTICE */}
        {view === 'pending_notice' && (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 mx-auto bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-2xl">
              ⏳
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Аризангиз қабул қилинди</h3>
              <p className="text-xs text-slate-500 mt-1">
                Ходим: <b>{pendingUser?.full_name || fullName}</b> ({pendingUser?.role_title || 'Ходим'})
              </p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 leading-relaxed text-left">
              Каюмов Жамшидбек, Паҳлавон ёки Басиржонов Жавлонбек аризангизни тасдиқлаганидан сўнг тизимга кира оласиз.
            </div>
            <button
              type="button"
              onClick={() => { setView('phone'); setError(''); }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs"
            >
              Ортга қайтиш
            </button>
          </div>
        )}

      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-blue-900/60 pb-2">
        Чархпалак Чойхонаси © 2026. Барча ҳуқуқлар ҳимояланган.
      </div>

    </div>
  );
}
