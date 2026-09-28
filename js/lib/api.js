/**
 * Backend integration seam — replace with real requests (e.g. your CRM).
 */
export async function submitInquiry(payload) {
  // await fetch('https://your-api.example.com/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  await new Promise((resolve) => setTimeout(resolve, 900));
  return { reference: `CA-${payload.apartmentId.replace('-', '')}-${Date.now().toString(36).slice(-4).toUpperCase()}` };
}
