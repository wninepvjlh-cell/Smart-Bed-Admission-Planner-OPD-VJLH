(function initDashboardFunctions() {
  const STANDARD_BEDS_FLOOR2 = new Set(['B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B14', 'B15', 'B16']);
  const SPECIAL_BEDS_FLOOR2 = new Set(['V1', 'V2', 'V3', 'V4', 'V5', 'V6']);
  const CACHE_INVALIDATION_KEYS = new Set([
    'bookingData',
    'ipd_female_standard_floor2',
    'ipd_female_special_floor2',
    'ipd_male_standard_floor2',
    'ipd_male_special_floor2',
    'ipd_active_beds_floor2'
  ]);

  let cachedAggregates = null;

  function normalizeText(value) {
    return (value || '').toString().trim().toLowerCase();
  }

  function normalizeGender(value) {
    const text = normalizeText(value);
    if (!text) return null;
    if (['ชาย', 'male', 'm', 'ชาย.'].includes(text)) return 'male';
    if (['หญิง', 'female', 'f', 'หญิง.'].includes(text)) return 'female';
    return null;
  }

  function isAdmittedFloor2Patient(patient) {
    if (!patient) return false;
    const floorValue = normalizeText(patient.floor || patient.floor_name || patient.ward || patient.ward_floor);
    const statusValue = normalizeText(patient.admit_status || patient.status);
    const matchesFloor = floorValue === 'floor2' ||
      floorValue === 'floor 2' ||
      floorValue === '2' ||
      floorValue.includes('floor2') ||
      floorValue.includes('floor 2') ||
      floorValue.includes('ชั้น 2');
    if (!matchesFloor || !statusValue) {
      return false;
    }
    if (statusValue === 'admitted' ||
        statusValue === 'admit' ||
        statusValue === 'ipd' ||
        statusValue === 'inward' ||
        statusValue === 'in ward') {
      return true;
    }
    if (statusValue.startsWith('admitted')) return true;
    return statusValue.startsWith('admit') && !statusValue.includes('waiting');
  }

  function classifyBedType(patient) {
    const assignedBed = (patient.assigned_bed || '').toString().trim().toUpperCase();
    if (assignedBed) {
      if (STANDARD_BEDS_FLOOR2.has(assignedBed)) return 'standard';
      if (SPECIAL_BEDS_FLOOR2.has(assignedBed)) return 'special';
    }
    const rawType = normalizeText(patient.bed_type || patient.bed_category || patient.room_type);
    if (!rawType) return null;
    if (rawType.includes('vip') || rawType.includes('special') || rawType.includes('พิเศษ')) return 'special';
    if (rawType.includes('standard') || rawType.includes('สามัญ') || rawType.includes('เตียงรวม')) return 'standard';
    return null;
  }

  function safeParseJSON(value) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('[Dashboard] Unable to parse JSON from localStorage', error);
      return null;
    }
  }

  function readBookingDataSnapshot() {
    const raw = localStorage.getItem('bookingData');
    const parsed = safeParseJSON(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { admitted: [] };
    }
    if (!Array.isArray(parsed.admitted)) {
      parsed.admitted = [];
    }
    return parsed;
  }

  function deduplicatePatients(patients) {
    const seen = new Set();
    return patients.filter(function(patient) {
      const key = patient.patient_hn || patient.hn || patient.patient_id || patient.id || (patient.assigned_bed ? 'bed:' + patient.assigned_bed : JSON.stringify(patient || {}));
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function setStorageIfChanged(key, value) {
    const serialized = value === null || value === undefined ? null : String(value);
    const current = localStorage.getItem(key);
    if (serialized === null) {
      if (current !== null) {
        localStorage.removeItem(key);
      }
      return;
    }
    if (current !== serialized) {
      localStorage.setItem(key, serialized);
    }
  }

  function computeAggregates() {
    const bookingSnapshot = readBookingDataSnapshot();
    const admittedPatients = deduplicatePatients((bookingSnapshot.admitted || []).filter(isAdmittedFloor2Patient));
    const aggregates = {
      femaleStandard: 0,
      femaleSpecial: 0,
      maleStandard: 0,
      maleSpecial: 0,
      activeBeds: admittedPatients.length
    };

    admittedPatients.forEach(function(patient) {
      const gender = normalizeGender(patient.patient_gender || patient.gender);
      const bedType = classifyBedType(patient);
      if (!gender || !bedType) {
        return;
      }
      if (gender === 'male') {
        if (bedType === 'special') aggregates.maleSpecial += 1;
        else aggregates.maleStandard += 1;
      } else {
        if (bedType === 'special') aggregates.femaleSpecial += 1;
        else aggregates.femaleStandard += 1;
      }
    });

    setStorageIfChanged('ipd_female_standard_floor2', aggregates.femaleStandard);
    setStorageIfChanged('ipd_female_special_floor2', aggregates.femaleSpecial);
    setStorageIfChanged('ipd_male_standard_floor2', aggregates.maleStandard);
    setStorageIfChanged('ipd_male_special_floor2', aggregates.maleSpecial);
    setStorageIfChanged('ipd_active_beds_floor2', aggregates.activeBeds);

    return aggregates;
  }

  function getAggregates() {
    if (!cachedAggregates) {
      cachedAggregates = computeAggregates();
    }
    return cachedAggregates;
  }

  function invalidateCache() {
    cachedAggregates = null;
  }

  function fetchFemaleStandardIPDFloor2() {
    const aggregates = getAggregates();
    return aggregates ? aggregates.femaleStandard : null;
  }

  function fetchFemaleSpecialIPDFloor2() {
    const aggregates = getAggregates();
    return aggregates ? aggregates.femaleSpecial : null;
  }

  function fetchMaleStandardIPDFloor2() {
    const aggregates = getAggregates();
    return aggregates ? aggregates.maleStandard : null;
  }

  function fetchMaleSpecialIPDFloor2() {
    const aggregates = getAggregates();
    return aggregates ? aggregates.maleSpecial : null;
  }

  window.fetchFemaleStandardIPDFloor2 = fetchFemaleStandardIPDFloor2;
  window.fetchFemaleSpecialIPDFloor2 = fetchFemaleSpecialIPDFloor2;
  window.fetchMaleStandardIPDFloor2 = fetchMaleStandardIPDFloor2;
  window.fetchMaleSpecialIPDFloor2 = fetchMaleSpecialIPDFloor2;
  window.refreshDashboardBedCounters = function refreshDashboardBedCounters() {
    invalidateCache();
    return getAggregates();
  };

  function subscribeToBookingChanges() {
    if (typeof window.onBookingDataChange === 'function') {
      window.onBookingDataChange(function handleDashboardBookingUpdate() {
        cachedAggregates = computeAggregates();
      });
    }
  }

  if (document.readyState === 'complete') {
    subscribeToBookingChanges();
  } else {
    window.addEventListener('load', subscribeToBookingChanges, { once: true });
  }

  window.addEventListener('storage', function(event) {
    if (!event || !event.key || CACHE_INVALIDATION_KEYS.has(event.key)) {
      invalidateCache();
    }
  });

  window.addEventListener('sbpRemoteStorageSync', function(event) {
    const key = event && event.detail ? event.detail.key : undefined;
    if (!key || CACHE_INVALIDATION_KEYS.has(key)) {
      invalidateCache();
    }
  });
})();
