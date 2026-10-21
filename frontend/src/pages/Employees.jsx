import React, { useState } from 'react';
import { 
  UserPlus, 
  Users, 
  Phone, 
  ShieldCheck, 
  Edit3, 
  Power, 
  AlertCircle, 
  X, 
  Save, 
  Check,
  CheckCircle2,
  XCircle,
  Info,
  Clock
} from 'lucide-react';

const STANDARD_ROLES = [
  { id: 'OWNER', title: 'Мулкдор (Эга)', isTop3: true },
  { id: 'SUPERVISOR', title: 'Иш бошқарувчи (РР)', isTop3: true },
  { id: 'MANAGER', title: 'Иш юритувчи (УД)', isTop3: true },
  { id: 'CASHIER', title: 'Кассир', isTop3: false },
  { id: 'BUTCHER', title: 'Қассоб', isTop3: false },
  { id: 'HEAD_CHEF', title: 'Бош ошпаз', isTop3: false },
  { id: 'SHASHLIK_CHEF', title: 'Шашликчи ошпаз', isTop3: false },
  { id: 'SOMSA_CHEF', title: 'Сомсапаз', isTop3: false },
  { id: 'COOK', title: 'Ошпаз', isTop3: false },
  { id: 'SUPPLIER', title: 'Таъминотчи (Харидчи)', isTop3: false },
  { id: 'DISHWASHER', title: 'Идиш ювувчи', isTop3: false },
  { id: 'CUSTOM', title: 'Бошқа лавозим...', isTop3: false },
];

export default function Employees({ 
  employees = [], 
  pendingApplicants = [],
  currentUser, 
  onCreateEmployee, 
  onUpdateEmployee, 
  onToggleStatus,
  onApproveApplicant,
  onRejectApplicant
}) {
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [editingEmp, setEditingEmp] = useState(null);

  const [phone, setPhone] = useState('+998');
  const [fullName, setFullName] = useState('');
  const [roleId, setRoleId] = useState('CASHIER');
  const [customRoleTitle, setCustomRoleTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const openCreateModal = () => {
    setModalMode('create');
    setEditingEmp(null);
    setPhone('+998');
    setFullName('');
    setRoleId('CASHIER');
    setCustomRoleTitle('');
    setError('');
  };

  const openEditModal = (emp) => {
    setModalMode('edit');
    setEditingEmp(emp);
    setPhone(emp.phone);
    setFullName(emp.full_name);
    setRoleId(STANDARD_ROLES.some(r => r.id === emp.role_id) ? emp.role_id : 'CUSTOM');
    setCustomRoleTitle(emp.role_title);
    setError('');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingEmp(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Ходим исм ва фамилиясини киритинг');
      return;
    }
    if (phone.length < 13) {
      setError('Тўлиқ телефон рақамини киритинг (масалан: +998901234567)');
      return;
    }

    const selectedRoleObj = STANDARD_ROLES.find(r => r.id === roleId);
    const finalRoleTitle = roleId === 'CUSTOM' ? customRoleTitle.trim() : (selectedRoleObj?.title || roleId);

    if (roleId === 'CUSTOM' && !customRoleTitle.trim()) {
      setError('Илтимос, янги лавозим номини ёзинг');
      return;
    }

    setLoading(true);
    try {
      if (modalMode === 'create') {
        await onCreateEmployee({
          phone,
          full_name: fullName.trim(),
          role_id: roleId,
          role_title: finalRoleTitle
        });
        setSuccessMsg('Янги ходим қўшилди!');
      } else if (modalMode === 'edit') {
        await onUpdateEmployee(editingEmp.id, {
          phone,
          full_name: fullName.trim(),
          role_id: roleId,
          role_title: finalRoleTitle,
          is_active: editingEmp.is_active
        });
        setSuccessMsg('Ходим маълумотлари янгиланди!');
      }
      setTimeout(() => setSuccessMsg(''), 3000);
      closeModal();
    } catch (err) {
      setError(err.message || 'Хатолик юз берди');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (emp) => {
    const actionText = emp.is_active ? 'нофаол қилиш' : 'фаоллаштириш';
    if (!window.confirm(`${emp.full_name} ни ${actionText}ни тасдиқлайсизми?`)) return;

    try {
      await onToggleStatus(emp.id);
    } catch (err) {
      alert(err.message || 'Хатолик');
    }
  };

  const top3Staff = employees.filter(e => ['OWNER', 'SUPERVISOR', 'MANAGER'].includes(e.role_id));
  const otherStaff = employees.filter(e => !['OWNER', 'SUPERVISOR', 'MANAGER'].includes(e.role_id));

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-24">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-blue-950 tracking-tight">
            Ходимлар бошқаруви
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Каюмов Жамшидбек, Паҳлавон, Басиржонов Жавлонбек назоратида
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="bg-blue-700 hover:bg-blue-800 active:scale-95 text-white text-xs font-bold py-2.5 px-3.5 rounded-xl shadow-md shadow-blue-700/20 flex items-center space-x-1.5 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Янги ходим</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* PENDING APPLICANTS TO APPROVE */}
      {pendingApplicants.length > 0 && (
        <div className="bg-sky-50 border-2 border-sky-300 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-xs font-black text-blue-950 uppercase tracking-wider">
            <Clock className="w-4 h-4 text-sky-700 animate-spin" />
            <span>Кутилаётган аризалар ({pendingApplicants.length} та)</span>
          </div>

          <div className="space-y-2">
            {pendingApplicants.map((app) => (
              <div key={app.id} className="bg-white p-3 rounded-xl border border-sky-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-blue-950 text-xs">{app.full_name}</div>
                  <div className="text-[11px] text-sky-700 font-semibold">{app.role_title}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{app.phone}</div>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => onApproveApplicant(app.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Қабул</span>
                  </button>
                  <button
                    onClick={() => onRejectApplicant(app.id)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[11px] font-bold px-2 py-1.5 rounded-lg active:scale-95"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOP 3 LEADERSHIP */}
      <div>
        <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
          <span>👑 Асосий Учлик (Раҳбарият)</span>
        </div>
        <div className="space-y-2">
          {top3Staff.map((emp) => (
            <div
              key={emp.id}
              className="bg-white rounded-2xl p-3.5 border border-blue-200 shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-black text-sm">
                  {emp.full_name.charAt(0)}
                </div>
                <div>
                  <div className="font-extrabold text-blue-950 text-sm">{emp.full_name}</div>
                  <div className="text-xs text-blue-700 font-semibold">{emp.role_title}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{emp.phone}</div>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => openEditModal(emp)}
                  className="p-2 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Таҳрирлаш"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* OTHER STAFF */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          <span>🍴 Чойхона Ходимлари ({otherStaff.length})</span>
        </div>

        {otherStaff.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-200 text-xs text-slate-400">
            Ҳозирча ходимлар мавжуд эмас. Янги ходимлар рўйхатдан ўтганда ёки юқоридаги тугма орқали қўшилади.
          </div>
        ) : (
          <div className="space-y-2">
            {otherStaff.map((emp) => (
              <div
                key={emp.id}
                className={`bg-white rounded-2xl p-3.5 border shadow-sm flex items-center justify-between ${
                  emp.is_active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/80 opacity-60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                    emp.is_active ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {emp.full_name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                      <span>{emp.full_name}</span>
                      {!emp.is_active && (
                        <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded">
                          Нофаол
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 font-medium">{emp.role_title}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{emp.phone}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEditModal(emp)}
                    className="p-2 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Таҳрирлаш"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(emp)}
                    className={`p-2 rounded-lg transition-colors ${
                      emp.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                    }`}
                    title={emp.is_active ? 'Нофаол қилиш' : 'Фаоллаштириш'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-blue-950 text-base">
                {modalMode === 'create' ? 'Янги ходим қўшиш' : 'Ходимни таҳрирлаш'}
              </h3>
              <button onClick={closeModal} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="pt-4 space-y-3.5 text-xs">
              {error && (
                <div className="p-2.5 bg-red-50 text-red-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Фамилия ва Исм
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Масалан: Алиев Жамшид"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-blue-600 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Телефон рақам
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998901234567"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Лавозими
                </label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  {STANDARD_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
              </div>

              {roleId === 'CUSTOM' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Янги лавозим номи
                  </label>
                  <input
                    type="text"
                    value={customRoleTitle}
                    onChange={(e) => setCustomRoleTitle(e.target.value)}
                    placeholder="Масалан: Сомса устози"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-700/30 flex items-center justify-center space-x-1.5 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'Сақланмоқда...' : 'Сақлаш'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
