async function runTests() {
  const BASE = 'http://localhost:4000/api';
  console.log('🧪 Starting End-to-End Tests for Charxpalak Choyxonasi...\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      process.exit(1);
    }
  }

  // 1. Fast login as Manager (UD: Azimov Farhod)
  console.log('--- Test 1: Authentication & Fast Login ---');
  const udLoginRes = await fetch(`${BASE}/auth/fast-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 3 })
  });
  const udData = await udLoginRes.json();
  assert(udData.ok && udData.user.role_id === 'MANAGER', 'UD (Azimov Farhod) muvaffaqiyatli tizimga kirdi');
  const udToken = udData.token;

  // 2. Fast login as Cashier (Ergashev Jamshid)
  const cashierLoginRes = await fetch(`${BASE}/auth/fast-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 4 })
  });
  const cashierData = await cashierLoginRes.json();
  assert(cashierData.ok && cashierData.user.role_id === 'CASHIER', 'Kassir (Ergashev Jamshid) muvaffaqiyatli kirdi');
  const cashierToken = cashierData.token;

  // 3. UD adds a new employee (Test butcher: Qurbonov Sarvar)
  console.log('\n--- Test 2: Employee Creation by Top 3 ---');
  const newPhone = '+998909990011';
  const addEmpRes = await fetch(`${BASE}/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${udToken}`
    },
    body: JSON.stringify({
      phone: newPhone,
      full_name: 'Qurbonov Sarvar',
      role_id: 'BUTCHER',
      role_title: 'Qassob'
    })
  });
  const newEmpData = await addEmpRes.json();
  assert(newEmpData.ok && newEmpData.employee.full_name === 'Qurbonov Sarvar', 'UD yangi qassob qo\'shdi');
  const butcherId = newEmpData.employee.id;

  // 4. Non-top-3 (Cashier) attempts to add employee -> should be 403 Forbidden!
  const forbiddenRes = await fetch(`${BASE}/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cashierToken}`
    },
    body: JSON.stringify({
      phone: '+998909990022',
      full_name: 'No Ruxsat',
      role_id: 'COOK'
    })
  });
  assert(forbiddenRes.status === 403, 'Oddiy xodim yangi xodim qo\'sha olmadi (403 taqiqlandi)');

  // 5. Money Transfer ("Pul berdim"): UD gives 7,500,000 to Qurbonov Sarvar
  console.log('\n--- Test 3: Money Transfer & Pending Status ---');
  const transferRes = await fetch(`${BASE}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${udToken}`
    },
    body: JSON.stringify({
      receiver_id: butcherId,
      amount: 7500000,
      category: 'Go\'sht xaridi',
      comment: '50 kg yangi go\'sht uchun naqd pul'
    })
  });
  const transferData = await transferRes.json();
  assert(transferData.ok && transferData.transaction.status === 'PENDING', 'Pul berildi va kutilmoqda holatiga o\'tdi (7,500,000 so\'m)');
  const txId = transferData.transaction.id;

  // 6. Recipient confirms receipt
  console.log('\n--- Test 4: Confirmation by Recipient ---');
  const butcherLoginRes = await fetch(`${BASE}/auth/fast-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: butcherId })
  });
  const butcherData = await butcherLoginRes.json();
  const butcherToken = butcherData.token;

  const confirmRes = await fetch(`${BASE}/transactions/${txId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${butcherToken}`
    }
  });
  const confirmData = await confirmRes.json();
  assert(confirmData.ok && confirmData.transaction.status === 'CONFIRMED' && confirmData.transaction.confirmed_at, 'Qassob pulni qabul qilganini tasdiqladi (CONFIRMED bo\'ldi)');

  // 7. CRITICAL REQUIREMENT TEST: Historical Name Immutability
  console.log('\n--- Test 5: Historical Name Immutability (Ism o\'zgarmasligi) ---');
  // Top 3 updates employee name to "Yoqubov Akmal" (e.g. employee changed/renamed)
  const updateEmpRes = await fetch(`${BASE}/employees/${butcherId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${udToken}`
    },
    body: JSON.stringify({
      full_name: 'Yoqubov Akmal',
      role_id: 'BUTCHER',
      role_title: 'Qassob'
    })
  });
  const updatedEmpData = await updateEmpRes.json();
  assert(updatedEmpData.ok && updatedEmpData.employee.full_name === 'Yoqubov Akmal', 'Qassobning yangi ismi saqlandi (Yoqubov Akmal)');

  // Check the past transaction txId in history
  const historyRes = await fetch(`${BASE}/transactions`, {
    headers: { 'Authorization': `Bearer ${udToken}` }
  });
  const historyData = await historyRes.json();
  const pastTx = historyData.transactions.find(t => t.id === txId);

  assert(
    pastTx && pastTx.receiver_full_name === 'Qurbonov Sarvar',
    `Eski tranzaksiyada xodimning o'sha paytdagi ismi buzilmasdan qoldi ("${pastTx?.receiver_full_name}")`
  );

  // Now create a NEW transaction with the renamed butcher
  const newTxRes = await fetch(`${BASE}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${udToken}`
    },
    body: JSON.stringify({
      receiver_id: butcherId,
      amount: 2000000,
      category: 'Go\'sht xaridi',
      comment: 'Yangi partiya uchun'
    })
  });
  const newTxData = await newTxRes.json();
  assert(
    newTxData.transaction.receiver_full_name === 'Yoqubov Akmal',
    `Yangi tranzaksiyada esa yangi xodim ismi qayd etildi ("${newTxData.transaction.receiver_full_name}")`
  );

  // 8. Rejection test
  console.log('\n--- Test 6: Rejection Flow ---');
  const rejectRes = await fetch(`${BASE}/transactions/${newTxData.transaction.id}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${butcherToken}`
    },
    body: JSON.stringify({ reason: 'Summa 2 mln emas, 1.5 mln kelgan' })
  });
  const rejectData = await rejectRes.json();
  assert(
    rejectData.ok && rejectData.transaction.status === 'REJECTED' && rejectData.transaction.reject_reason.includes('1.5 mln'),
    'Noto\'g\'ri to\'lov muvaffaqiyatli rad etildi va sababi qayd qilindi'
  );

  console.log(`\n🎉 Barcha testlar muvaffaqiyatli yakunlandi: ${passed}/${total} PASS!`);
}

runTests().catch(err => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
