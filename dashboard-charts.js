// For IMC : Non-IMC Ratio (Admitted) bar chart in dashboard.html
function getIMCNonIMCByDiseaseFloor2() {
  // 6 groups: Stroke, SCI (Tetraplegia), SCI (Paraplegia), TBI, Hip fracture, อื่นๆ
  const imc = [0, 0, 0, 0, 0, 0];
  const nonimc = [0, 0, 0, 0, 0, 0];
  const patients = getAdmittedPatientsFloor2();
  patients.forEach(p => {
    const idx = getDiseaseGroupIndex(p.diagnosis);
    if (getIMCStatus(p)) {
      imc[idx]++;
    } else {
      nonimc[idx]++;
    }
  });
  return { imc, nonimc };
}
// Pie Chart: 6 กลุ่มโรคหลัก Admit ชั้น 2 (ใช้ข้อมูลจริง)
const pieLabels = [
  'Stroke',
  'SCI (Tetraplegia)',
  'SCI (Paraplegia)',
  'TBI',
  'Hip fracture',
  'อื่นๆ'
];
const pieColors = [
  '#b2ebf2', '#4dd0e1', '#80cbc4', '#26c6da', '#0097a7', '#43a047'
];

const bookingDataListeners = [];

function normalizeValue(value) {
  return (value || '').toString().trim().toLowerCase();
}

function isAdmittedFloor2Patient(patient) {
  if (!patient) {
    return false;
  }
  const floorValue = normalizeValue(patient.floor || patient.floor_name || patient.ward || patient.ward_floor);
  const statusValue = normalizeValue(patient.admit_status || patient.status);
  const matchesFloor = floorValue === 'floor2' ||
    floorValue === 'floor 2' ||
    floorValue === '2' ||
    floorValue.includes('floor2') ||
    floorValue.includes('floor 2') ||
    floorValue.includes('ชั้น 2');
  if (!matchesFloor) {
    return false;
  }
  if (!statusValue) {
    return false;
  }
  if (statusValue === 'admitted' ||
      statusValue === 'admit' ||
      statusValue === 'ipd' ||
      statusValue === 'inward' ||
      statusValue === 'in ward') {
    return true;
  }
  if (statusValue.startsWith('admitted')) {
    return true;
  }
  return statusValue.startsWith('admit') && !statusValue.includes('waiting');
}

function notifyBookingDataListeners(key) {
  if (key && key !== 'bookingData') {
    return;
  }
  bookingDataListeners.forEach(function(listener) {
    try {
      listener();
    } catch (error) {
      console.warn('Dashboard booking listener failed', error);
    }
  });
}

function onBookingDataChange(callback) {
  if (typeof callback === 'function') {
    bookingDataListeners.push(callback);
  }
}

window.addEventListener('storage', function(event) {
  notifyBookingDataListeners(event && typeof event.key === 'string' ? event.key : undefined);
});

window.addEventListener('sbpRemoteStorageSync', function(event) {
  const detail = event && event.detail;
  notifyBookingDataListeners(detail && typeof detail.key === 'string' ? detail.key : undefined);
});

function getAdmittedPatientsFloor2() {
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { admitted: [] };
  return (bookingData.admitted || []).filter(isAdmittedFloor2Patient);
}

function getDiseaseGroupIndex(diagnosis) {
  const diag = (diagnosis || '').toString().toLowerCase();
  if (!diag) return 5;
  if (diag.includes('stroke')) return 0;
  if (diag.includes('tetra')) return 1;
  if (diag.includes('para')) return 2;
  if (diag.includes('tbi')) return 3;
  if (diag.includes('hip')) return 4;
  return 5;
}

function getIMCStatus(patient) {
  return (patient.imc_status || patient.imc || '').toString().toUpperCase() === 'IMC';
}

function calculatePieData() {
  const patients = getAdmittedPatientsFloor2();
  const pieIMC = [0, 0, 0, 0, 0, 0];
  const pieNonIMC = [0, 0, 0, 0, 0, 0];
  patients.forEach(p => {
    const idx = getDiseaseGroupIndex(p.diagnosis);
    if (getIMCStatus(p)) {
      pieIMC[idx]++;
    } else {
      pieNonIMC[idx]++;
    }
  });
  return { pieIMC, pieNonIMC, pieData: pieIMC.map((imc, i) => imc + pieNonIMC[i]) };
}

function renderPieChart() {
  const { pieIMC, pieNonIMC, pieData } = calculatePieData();
  const canvas = document.getElementById('mainDiseasePieChart');
  if (!canvas) return;
  const ctxPie = canvas.getContext('2d');
  if (window.mainDiseasePieChart && window.mainDiseasePieChart.data && window.mainDiseasePieChart.data.datasets) {
    window.mainDiseasePieChart.data.datasets[0].data = pieData;
    window.mainDiseasePieChart.$pieIMC = pieIMC;
    window.mainDiseasePieChart.$pieNonIMC = pieNonIMC;
    window.mainDiseasePieChart.update();
  } else {
    window.mainDiseasePieChart = new Chart(ctxPie, {
      type: 'pie',
      data: {
        labels: pieLabels,
        datasets: [{
          data: pieData,
          backgroundColor: pieColors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const idx = context.dataIndex;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const value = context.dataset.data[idx];
                const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                const chartInstance = context.chart;
                const imcSource = chartInstance.$pieIMC || [];
                const nonimcSource = chartInstance.$pieNonIMC || [];
                const imc = imcSource[idx] || 0;
                const nonimc = nonimcSource[idx] || 0;
                return `${pieLabels[idx]}: ${percent}% (${value} คน)\nIMC: ${imc} คน, Non-IMC: ${nonimc} คน`;
              }
            }
          },
          title: { display: false }
        }
      }
    });
    window.mainDiseasePieChart.$pieIMC = pieIMC;
    window.mainDiseasePieChart.$pieNonIMC = pieNonIMC;
  }

  function renderCustomLegend(chart, legendId) {
    const ul = document.createElement('ul');
    const data = chart.data.datasets[0].data;
    chart.data.labels.forEach((label, i) => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'space-between';
      li.style.margin = '6px 0';
      li.style.fontFamily = '"Sarabun", "Prompt", "Segoe UI", Arial, sans-serif';
      li.style.fontWeight = '600';
      li.style.fontSize = '1.08rem';
      li.style.letterSpacing = '0.2px';
      li.style.color = '#006064';
      const leftBox = document.createElement('div');
      leftBox.style.display = 'flex';
      leftBox.style.alignItems = 'center';
      const colorBox = document.createElement('span');
      colorBox.style.background = chart.data.datasets[0].backgroundColor[i];
      colorBox.style.display = 'inline-block';
      colorBox.style.width = '16px';
      colorBox.style.height = '16px';
      colorBox.style.marginRight = '6px';
      colorBox.style.borderRadius = '4px';
      colorBox.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
      leftBox.appendChild(colorBox);
      const text = document.createElement('span');
      text.textContent = label;
      text.style.whiteSpace = 'nowrap';
      text.style.overflow = 'hidden';
      text.style.textOverflow = 'ellipsis';
      leftBox.appendChild(text);
      li.appendChild(leftBox);
      const number = document.createElement('span');
      number.textContent = data[i] + ' คน';
      number.style.textAlign = 'right';
      number.style.flex = '0 0 60px';
      li.appendChild(number);
      ul.appendChild(li);
    });
    ul.className = 'chartjs-legend-grid';
    const legendDiv = document.getElementById(legendId);
    if (!legendDiv) return;
    legendDiv.innerHTML = '';
    legendDiv.appendChild(ul);
  }

  renderCustomLegend(window.mainDiseasePieChart, 'mainDiseasePieLegend');
}

renderPieChart();
setInterval(renderPieChart, 5000);
onBookingDataChange(renderPieChart);

function getBookingWaitingTimeData() {
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], confirmed: [], admitted: [] };
  // Combine all arrays and deduplicate
  const all = [
    ...(bookingData.booked || []),
    ...(bookingData.confirmed || []),
    ...(bookingData.admitted || [])
  ];
  const seen = new Set();
  const patients = all.filter(function(patient) {
    const key = patient.patient_hn || patient.hn || patient.patient_id || patient.id || (patient.assigned_bed ? 'bed:' + patient.assigned_bed : JSON.stringify(patient || {}));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  function parseWaitingTime(val) {
    if (!val) return null;
    if (typeof val === 'number') return val;
    if (/^\d+$/.test(val)) return parseInt(val, 10);
    let wk = 0;
    let d = 0;
    const weekMatch = val.match(/(\d+)\s*สัปดาห์/);
    const dayMatch = val.match(/(\d+)\s*วัน/);
    if (weekMatch) wk = parseInt(weekMatch[1], 10);
    if (dayMatch) d = parseInt(dayMatch[1], 10);
    return wk * 7 + d;
  }

  const maxDay = 45;
  const waitingIMC = Array(maxDay + 1).fill(0);
  const waitingNonIMC = Array(maxDay + 1).fill(0);

  patients.forEach(p => {
    const days = parseWaitingTime(p.waiting_time);
    if (days === null || Number.isNaN(days) || days < 0 || days > maxDay) return;
    const imc = (p.imc_status || '').toString().toUpperCase() === 'IMC';
    if (imc) waitingIMC[days]++;
    else waitingNonIMC[days]++;
  });

  return { waitingIMC, waitingNonIMC };
}

const appointmentChannelDefinitions = [
  { key: 'OPD case', label: 'OPD case' },
  { key: 'IPD case', label: 'IPD case' },
  { key: 'Telemedicine', label: 'Telemedicine' },
  { key: 'Seamless Refer', label: 'Seamless Refer' },
  { key: 'walk in', label: 'Walk in' }
];

function getBookingChannelCounts() {
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], confirmed: [], admitted: [] };
  // Combine all arrays and deduplicate
  const all = [
    ...(bookingData.booked || []),
    ...(bookingData.confirmed || []),
    ...(bookingData.admitted || [])
  ];
  const seen = new Set();
  const patients = all.filter(function(patient) {
    const key = patient.patient_hn || patient.hn || patient.patient_id || patient.id || (patient.assigned_bed ? 'bed:' + patient.assigned_bed : JSON.stringify(patient || {}));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const counts = appointmentChannelDefinitions.map(() => 0);
  let otherCount = 0;

  patients.forEach(patient => {
    const raw = (patient.appointment_channel || '').toString().trim();
    if (!raw) {
      otherCount++;
      return;
    }
    const matchIdx = appointmentChannelDefinitions.findIndex(def => def.key.toLowerCase() === raw.toLowerCase());
    if (matchIdx >= 0) {
      counts[matchIdx]++;
    } else {
      otherCount++;
    }
  });

  const labels = appointmentChannelDefinitions.map(def => def.label);
  if (otherCount > 0) {
    labels.push('อื่นๆ');
    counts.push(otherCount);
  }

  return { labels, counts, total: patients.length };
}

let waitingTimeLineChart = null;
let appointmentChannelBarChart = null;

function renderWaitingTimeLineChart() {
  const canvas = document.getElementById('waitingTimeLineChart');
  if (!canvas) return;
  const ctxWaiting = canvas.getContext('2d');
  const waitingDays = Array.from({ length: 46 }, function(_, i) { return i; });
  const data = getBookingWaitingTimeData();
  const waitingIMC = data.waitingIMC;
  const waitingNonIMC = data.waitingNonIMC;

  if (waitingTimeLineChart) {
    waitingTimeLineChart.data.datasets[0].data = waitingIMC;
    waitingTimeLineChart.data.datasets[1].data = waitingNonIMC;
    waitingTimeLineChart.update();
    return;
  }

  waitingTimeLineChart = new Chart(ctxWaiting, {
    type: 'line',
    data: {
      labels: waitingDays,
      datasets: [
        {
          label: 'IMC',
          data: waitingIMC,
          borderColor: '#4dd0e1',
          backgroundColor: 'rgba(77,208,225,0.15)',
          fill: false,
          tension: 0.2
        },
        {
          label: 'Non-IMC',
          data: waitingNonIMC,
          borderColor: '#b2ebf2',
          backgroundColor: 'rgba(178,235,242,0.15)',
          fill: false,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, position: 'top' },
        title: { display: false }
      },
      scales: {
        x: {
          title: { display: true, text: 'waiting time (day)' },
          min: 0,
          max: 45
        },
        y: {
          title: { display: true, text: 'Patient Count' },
          beginAtZero: true
        }
      }
    }
  });
}

function renderAppointmentChannelBarChart() {
  const canvas = document.getElementById('appointmentChannelBarChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = getBookingChannelCounts();
  const labels = data.labels;
  const counts = data.counts;
  const total = data.total;
  const totalEl = document.getElementById('appointmentChannelTotal');
  if (totalEl) totalEl.textContent = total;

  const colorPalette = ['#4dd0e1', '#80deea', '#aed581', '#ffd54f', '#ce93d8', '#90a4ae'];
  const colors = labels.map(function(_, idx) {
    return colorPalette[idx % colorPalette.length];
  });

  if (appointmentChannelBarChart) {
    appointmentChannelBarChart.data.labels = labels;
    appointmentChannelBarChart.data.datasets[0].data = counts;
    appointmentChannelBarChart.data.datasets[0].backgroundColor = colors;
    appointmentChannelBarChart.update();
    return;
  }

  appointmentChannelBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'จำนวนผู้ป่วย',
          data: counts,
          backgroundColor: colors,
          borderRadius: 6,
          maxBarThickness: 36
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: '#006064',
          font: { weight: 'bold', size: 14 },
          formatter: function(value) { return value > 0 ? value : ''; }
        }
      },
      scales: {
        x: {
          ticks: { autoSkip: false }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'จำนวนผู้ป่วย' }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

renderWaitingTimeLineChart();
renderAppointmentChannelBarChart();
setInterval(renderWaitingTimeLineChart, 5000);
setInterval(renderAppointmentChannelBarChart, 5000);
onBookingDataChange(function() {
  renderWaitingTimeLineChart();
  renderAppointmentChannelBarChart();
});

function getBookingPatients() {
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], confirmed: [], admitted: [] };
  // Combine all arrays
  const all = [
    ...(bookingData.booked || []),
    ...(bookingData.confirmed || []),
    ...(bookingData.admitted || [])
  ];
  // Deduplicate by patient_hn, hn, patient_id, or id
  const seen = new Set();
  return all.filter(function(patient) {
    const key = patient.patient_hn || patient.hn || patient.patient_id || patient.id || (patient.assigned_bed ? 'bed:' + patient.assigned_bed : JSON.stringify(patient || {}));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getBookingDiseaseGroupIndex(diagnosis) {
  const diag = (diagnosis || '').toString().toLowerCase();
  if (!diag) return 5;
  if (diag.includes('stroke')) return 0;
  if (diag.includes('tetra')) return 1;
  if (diag.includes('para')) return 2;
  if (diag.includes('tbi')) return 3;
  if (diag.includes('hip')) return 4;
  return 5;
}

function renderBookingByDisease() {
  const bookingDiseaseLabels = [
    'Stroke',
    'SCI (Tetraplegia)',
    'SCI (Paraplegia)',
    'TBI',
    'Hip fracture',
    'อื่นๆ'
  ];
  const bookingBody = document.getElementById('bookingByDiseaseBody');
  if (!bookingBody) return;
  bookingBody.innerHTML = '';
  const patients = getBookingPatients();
  const bookingByDisease = [0, 0, 0, 0, 0, 0];
  patients.forEach(p => {
    const idx = getBookingDiseaseGroupIndex(p.diagnosis);
    bookingByDisease[idx]++;
  });
  let bookingTotal = 0;
  bookingByDisease.forEach(function(count, i) {
    const tr = document.createElement('tr');
    tr.innerHTML = "<td style='padding: 6px 8px;'>" + bookingDiseaseLabels[i] + "</td><td style='text-align: right; padding: 6px 8px;'>" + count + '</td>';
    bookingBody.appendChild(tr);
    bookingTotal += count;
  });
  const totalEl = document.getElementById('bookingTotal');
  if (totalEl) totalEl.textContent = bookingTotal;
}

renderBookingByDisease();
setInterval(renderBookingByDisease, 5000);
onBookingDataChange(renderBookingByDisease);

function updateDashboardDateTime() {
  const now = new Date();
  const thMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const thDate = now.getDate() + ' ' + thMonths[now.getMonth()] + ' ' + (now.getFullYear() + 543) + ', ' +
    now.getHours().toString().padStart(2,'0') + ':' +
    now.getMinutes().toString().padStart(2,'0') + ':' +
    now.getSeconds().toString().padStart(2,'0');
  const el = document.getElementById('dashboardDateTime');
  if (el) el.textContent = thDate;
}

setInterval(updateDashboardDateTime, 1000);
updateDashboardDateTime();