(function initializeFirestoreSync() {
  if (typeof window === 'undefined') {
    return;
  }

  window.__sbpFirestoreSyncEnabled = true;

  if (!window.sbpFirebase || !window.sbpFirebase.firestore) {
    console.warn('[FirestoreSync] Firestore instance not available');
    return;
  }

  const firestore = window.sbpFirebase.firestore;
  const FieldValue = window.firebase && window.firebase.firestore
    ? window.firebase.firestore.FieldValue
    : null;

  if (!FieldValue) {
    console.warn('[FirestoreSync] FieldValue helper not found');
  }
  const STORAGE_COLLECTION = 'appStorage';
  const STORAGE_DOC_ID = 'localStorage';
  const RESERVED_PREFIX = '__';
  const SYNCED_KEYS = new Set([
    'bookingData',
    'ipdData',
    'ipd_female_standard_floor2',
    'ipd_female_special_floor2',
    'ipd_male_standard_floor2',
    'ipd_male_special_floor2',
    'ipd_active_beds_floor2'
  ]);

  window.sbpRegisterSyncedKey = function registerSyncedKey(key) {
    if (key && typeof key === 'string') {
      SYNCED_KEYS.add(key);
    }
  };

  const docRef = firestore.collection(STORAGE_COLLECTION).doc(STORAGE_DOC_ID);
  const pendingWrites = new Map();
  let isApplyingRemoteUpdate = false;
  let isInitialized = false;
  const queuedSyncOps = [];

  function reserveAwareKeys(data) {
    return Object.keys(data || {}).filter(key => !key.startsWith(RESERVED_PREFIX));
  }

  function pushSyncOp(fn) {
    if (isInitialized) {
      fn();
    } else {
      queuedSyncOps.push(fn);
    }
  }

  function flushQueuedSyncOps() {
    while (queuedSyncOps.length) {
      try {
        const task = queuedSyncOps.shift();
        task();
      } catch (error) {
        console.error('[FirestoreSync] Failed queued sync op', error);
      }
    }
  }

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  function shouldSyncKey(key) {
    return SYNCED_KEYS.has(key);
  }

  function setLocalSilently(key, value) {
    isApplyingRemoteUpdate = true;
    try {
      if (value === null || value === undefined) {
        originalRemoveItem.call(localStorage, key);
      } else {
        originalSetItem.call(localStorage, key, value);
      }
    } finally {
      isApplyingRemoteUpdate = false;
    }
    try {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('sbpRemoteStorageSync', { detail: { key, value } }));
    } catch (error) {
      console.warn('[FirestoreSync] Unable to dispatch sync events', error);
    }
  }

  function syncSet(key, value) {
    if (!shouldSyncKey(key)) {
      return;
    }
    pendingWrites.set(key, value);
    docRef.set({
      [key]: value,
      [`${RESERVED_PREFIX}updatedAt`]: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
    }, { merge: true }).catch(error => {
      console.error('[FirestoreSync] Failed to write key to Firestore', key, error);
    });
  }

  function syncRemove(key) {
    if (!shouldSyncKey(key)) {
      return;
    }
    if (!FieldValue) {
      console.warn('[FirestoreSync] Cannot remove key without FieldValue helper', key);
      return;
    }
    pendingWrites.set(key, null);
    docRef.set({
      [key]: FieldValue.delete(),
      [`${RESERVED_PREFIX}updatedAt`]: FieldValue.serverTimestamp()
    }, { merge: true }).catch(error => {
      console.error('[FirestoreSync] Failed to remove key from Firestore', key, error);
    });
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    originalSetItem.apply(this, arguments);
    if (isApplyingRemoteUpdate) {
      return;
    }
    pushSyncOp(function syncSetItemOp() {
      syncSet(key, value);
    });
  };

  Storage.prototype.removeItem = function patchedRemoveItem(key) {
    originalRemoveItem.apply(this, arguments);
    if (isApplyingRemoteUpdate) {
      return;
    }
    pushSyncOp(function syncRemoveItemOp() {
      syncRemove(key);
    });
  };

  function applyRemoteSnapshot(data) {
    const keys = reserveAwareKeys(data);
    keys.forEach(function registerKey(key) {
      SYNCED_KEYS.add(key);
    });

    SYNCED_KEYS.forEach(function ensureUpdate(key) {
      const hasRemote = Object.prototype.hasOwnProperty.call(data, key);
      const remoteValue = hasRemote ? data[key] : null;

      if (pendingWrites.has(key)) {
        const expected = pendingWrites.get(key);
        const matches = (expected === null && remoteValue == null) || expected === remoteValue;
        if (matches) {
          pendingWrites.delete(key);
          return;
        }
      }

      const localValue = localStorage.getItem(key);
      if (!hasRemote) {
        if (localValue !== null) {
          setLocalSilently(key, null);
        }
        return;
      }

      if (remoteValue !== localValue) {
        setLocalSilently(key, remoteValue);
      }
    });
  }

  function captureLocalDefaults() {
    const defaults = {};
    SYNCED_KEYS.forEach(function collect(key) {
      const value = localStorage.getItem(key);
      if (value !== null && value !== undefined) {
        defaults[key] = value;
      }
    });
    return defaults;
  }

  const initialLoadPromise = docRef.get().then(function snapshotLoaded(snapshot) {
    if (snapshot.exists) {
      applyRemoteSnapshot(snapshot.data() || {});
      return;
    }

    const initialData = captureLocalDefaults();
    if (FieldValue) {
      initialData[`${RESERVED_PREFIX}createdAt`] = FieldValue.serverTimestamp();
    }
    return docRef.set(initialData, { merge: true });
  }).catch(function handleInitialLoadError(error) {
    console.error('[FirestoreSync] Failed to load initial data', error);
  }).finally(function finalizeInitialization() {
    isInitialized = true;
    flushQueuedSyncOps();
  });

  window.sbpStorageReadyPromise = initialLoadPromise.then(function () {
    return undefined;
  });

  docRef.onSnapshot(function onSnapshot(snapshot) {
    if (!snapshot.exists) {
      return;
    }
    applyRemoteSnapshot(snapshot.data() || {});
  }, function onSnapshotError(error) {
    console.error('[FirestoreSync] Snapshot listener error', error);
  });
})();
