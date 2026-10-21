# 🫖 Charxpalak Choyxonasi — Pul Harakati va Xodimlar Tizimi (PWA)

Charxpalak choyxonasi xodimlari uchun to'liq **o'zbek tilida** yaratilgan, sodda, ortiqcha narsalarsiz (minimalist) va tezkor **Progressive Web App (PWA)** dasturi.

---

## 🌟 Asosiy Imkoniyatlar va Qoidalar

1. **👑 Asosiy Uchlik (Rahbariyat):**
   - **Mulkdor (Ega)**
   - **Ish boshqaruvchi**
   - **Ish yurituvchi (UD)**
   - *Faqat ushbu 3 kishi yangi xodimlarni (kassir, qassob, oshpazlar va h.k.) qo'sha oladi, tahrirlay oladi yoki nofaol qila oladi.*
   - *Barcha pul aylanmasi, tranzaksiyalar tarixi va to'liq hisobotlar ushbu uchlikka ochiq ko'rinadi.*

2. **💸 Pul berish va Tasdiqlash tizimi:**
   - Masalan: Ish yurituvchi (UD) **"Pul berish"** tugmasini bosadi.
   - Ro'yxatdan qabul qiluvchi xodimni (masalan: **Ergashev Jamshid (Kassir)**) tanlaydi.
   - Summani kiritadi (masalan: `5 000 000` so'm) va xarajat maqsadini tanlaydi.
   - Kassirning telefoniga darhol bildirishnoma boradi va uning ekranida tasdiqlash kartasi chiqadi.
   - Kassir **"✅ Qabul qildim"** tugmasini bosadi va summa tasdiqlangan holatga o'tadi. Noto'g'ri bo'lsa **"❌ Rad etish"** tugmasini bosishi mumkin.

3. **🔒 Tarixiy Ismlar Daxlsizligi (O'chmas ismlar):**
   - Har bir tranzaksiyada pul beruvchi va oluvchining familiyasi, ismi va lavozimi **muhrlanadi (snapshot)**.
   - Agar xodim ishdan ketsa yoki o'rniga boshqa odam kelib ismi o'zgartirilsa, **o'tgan barcha to'lovlarda avvalgi xodimning ismi o'zgarmasdan qoladi**.
   - Yangi xodimning ismi faqat u kelganidan keyingi yangi to'lovlarda aks etadi.

4. **📱 PWA (Telefonga Ilova Sifatida O'rnatish):**
   - Brauzer orqali ochilganda ekranda **"O'rnatish"** tugmasi chiqadi.
   - Android va iOS telefonlarga to'liq mustaqil ilova bo'lib o'rnatiladi.
   - Oflayn keshlash va tezkor ishlash uchun Service Worker integratsiya qilingan.

5. **✈️ Bepul Telegram Bot Orqali Kirish (SMS o'rniga 0 so'm):**
   - SMS har biri 50-80 so'm pul turishi tufayli, ilovaga **100% BEPUL Telegram Bot** mexanizmi o'rnatilgan.
   - Xodim telefon raqamini kiritib **"Telegram orqali kod olish"** tugmasini bosadi va uning Telegramiga 4 xonali kirish kodi boradi.
   - Shuningdek, dasturni darhol sinash uchun qulay **Tezkor Sinov (Demo Switcher)** tugmalari mavjud.

---

## 🚀 Qanday Ishga Tushiriladi?

### 1. Dasturni ishga tushirish:
```bash
npm start
```
Dastur avtomatik ravishda `http://localhost:4000` manzilida ochiladi.

### 2. Dasturni qayta yig'ish (agar dizayn o'zgarsa):
```bash
npm run build
```

---

## 🤖 Bepul Telegram Botni Ulash (30 soniya)

1. Telegramda rasmiy **@BotFather** botiga kiring.
2. `/newbot` buyrug'ini yuboring.
3. Botga nom bering (masalan: `Charxpalak Choyxona Boti`) va username bering (masalan: `CharxpalakHisobBot`).
4. BotFather bergan **HTTP API Token**ni oling.
5. Dasturda **"Sozlamalar"** bo'limiga kirib Tokenni joylang va saqlang.
6. Bo'ldi! Endi xodimlarga bepul kirish kodlari va to'lov bildirishnomalari Telegram orqali yuboriladi.

---

## 📂 Loyiha Tuzilmasi

- `backend/` — Express API, SQLite ma'lumotlar bazasi (`charxpalak.db`), Telegram bot integratsiyasi va xavfsizlik.
- `frontend/` — React 18, Vite, Tailwind CSS, Lucide Icons, PWA manifesti va Service Worker.
- `package.json` — Loyihani boshqarish skriptlari.
