async function testNewSystem() {
  const BASE = 'http://localhost:4000/api';
  console.log('🧪 Testing new user registration, real leadership and approval flow...\n');

  // 1. Verify 3 leaders exist
  const resUD = await fetch(`${BASE}/auth/fast-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 3 })
  });
  const udData = await resUD.json();
  console.log('Leader 1 (UD):', udData.user.full_name, '-', udData.user.role_title);
  if (udData.user.full_name !== 'Пахлавон') throw new Error('Expected UD to be Пахлавон');

  const resOwner = await fetch(`${BASE}/auth/fast-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 1 })
  });
  const ownerData = await resOwner.json();
  console.log('Leader 2 (Owner):', ownerData.user.full_name, '-', ownerData.user.role_title);
  if (ownerData.user.full_name !== 'Qayumov Jamshidbek') throw new Error('Expected Owner to be Qayumov Jamshidbek');

  const resRR = await fetch(`${BASE}/auth/fast-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 2 })
  });
  const rrData = await resRR.json();
  console.log('Leader 3 (RR):', rrData.user.full_name, '-', rrData.user.role_title);
  if (rrData.user.full_name !== 'Басиржонов Жавлонбек') throw new Error('Expected RR to be Басиржонов Жавлонбек');

  // 2. New employee self-registers
  console.log('\n--- Employee Registration ---');
  const regRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '+998905557788',
      full_name: 'Salimov Sardor',
      role_id: 'BUTCHER',
      role_title: 'Qassob'
    })
  });
  const regData = await regRes.json();
  console.log('Registration response:', regData.message);
  if (!regData.ok || !regData.isPendingApproval) throw new Error('Registration failed');

  // 3. Leader checks pending list
  console.log('\n--- Leadership Approval ---');
  const pendingRes = await fetch(`${BASE}/employees/pending`, {
    headers: { 'Authorization': `Bearer ${udData.token}` }
  });
  const pendingData = await pendingRes.json();
  const applicant = pendingData.pending.find(p => p.full_name === 'Salimov Sardor');
  if (!applicant) throw new Error('Applicant not found in pending list');
  console.log('Found pending applicant:', applicant.full_name, applicant.role_title);

  // Leader approves
  const approveRes = await fetch(`${BASE}/employees/${applicant.id}/approve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${udData.token}` }
  });
  const approveData = await approveRes.json();
  console.log('Approval response:', approveData.message);
  if (!approveData.ok) throw new Error('Approval failed');

  // 4. Money transfer from Пахлавон to Salimov Sardor
  console.log('\n--- Money Transfer & In-App Status ---');
  const txRes = await fetch(`${BASE}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${udData.token}`
    },
    body: JSON.stringify({
      receiver_id: applicant.id,
      amount: 5000000,
      category: 'Go\'sht xaridi',
      comment: 'Ertalabki mol go\'shti uchun'
    })
  });
  const txData = await txRes.json();
  console.log('Transaction created:', txData.transaction.id, txData.transaction.status, txData.transaction.amount);

  // Login as approved employee and confirm
  const empLogin = await fetch(`${BASE}/auth/fast-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: applicant.id })
  });
  const empToken = (await empLogin.json()).token;

  const confirmRes = await fetch(`${BASE}/transactions/${txData.transaction.id}/confirm`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  const confirmData = await confirmRes.json();
  console.log('Transaction confirmed:', confirmData.transaction.status, 'confirmed_at:', confirmData.transaction.confirmed_at);

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

testNewSystem().catch(err => {
  console.error(err);
  process.exit(1);
});
