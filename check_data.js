const data = localStorage.getItem('bookingData');
if (data) {
  const parsed = JSON.parse(data);
  console.log('Confirmed patients:', JSON.stringify(parsed.confirmed, null, 2));
}
