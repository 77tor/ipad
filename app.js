// Firebase Konfigurasjon
const firebaseConfig = {
  apiKey: "AIzaSyCAgQrwK27-XBWaTp4RNLjvO7_KS5lZHzc",
  authDomain: "ipad-database-e63f5.firebaseapp.com",
  databaseURL: "https://ipad-database-e63f5-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ipad-database-e63f5",
  storageBucket: "ipad-database-e63f5.firebasestorage.app",
  messagingSenderId: "6857934416",
  appId: "1:6857934416:web:2dfbff43a98379e3e77355",
  measurementId: "G-SFWECC2NG7"
};

// Initialiser Firebase umiddelbart ved oppstart
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Globale variabler
let ipads = [];
let dbRef = null;
let isFirebaseActive = false;

// Skoleår variabler
let tilgjengeligeSkolear = [];
let aktivtSkolear = '';
let valgtSkolear = '';

// Sorteringsvariabler
let currentSortColumn = 'ipadnr';
let currentSortDirection = 'asc';

// Standard eksempeldata
const INITIAL_SAMPLE_DATA = [
  { id: '1', etternavn: 'Fredly', fornavn: 'Andreas', trinn: '6', klasse: '6A', brukernavn: '14andreas1', ipadnr: '1001', serienr: 'A1893', lagtIEndpoint: '22.08.2024', skolested: 'Brattbakken', status: 'I bruk', notat: '' },
  { id: '2', etternavn: 'Andersen', fornavn: 'Aleksander Catin', trinn: '6', klasse: '6A', brukernavn: '14aleksander1', ipadnr: '1002', serienr: 'A2602', lagtIEndpoint: '22.08.2024', skolested: 'Brattbakken', status: 'I bruk', notat: '' },
  { id: '3', etternavn: 'Gabrielsen', fornavn: 'Ivy Vinter Paddon', trinn: '3', klasse: '3A', brukernavn: '18ivy', ipadnr: '1003', serienr: '', lagtIEndpoint: '13.09.2024', skolested: 'Heståsen', status: 'I bruk', notat: '' },
  { id: '4', etternavn: '', fornavn: '', trinn: '', klasse: '', brukernavn: '', ipadnr: '1012', serienr: '', lagtIEndpoint: '', skolested: '', status: 'Tilgjengelig', notat: 'Lager' },
  { id: '5', etternavn: '', fornavn: '', trinn: '', klasse: '', brukernavn: '', ipadnr: '1027', serienr: '', lagtIEndpoint: '', skolested: '', status: 'Kassert', notat: '' }
];


// Hjelpefunksjon som finner inneværende skoleår basert på dato (skifte skjer 1. august)
function getGjeldendeSkolear() {
  const naa = new Date();
  const ar = naa.getFullYear();
  const maaned = naa.getMonth() + 1; // 1 = Jan, 8 = Aug
  return maaned >= 8 ? `${ar}-${ar + 1}` : `${ar - 1}-${ar}`;
}

// 1. Database-initiering med Skoleårsstruktur
function initDatabase() {
  try {
    isFirebaseActive = true;

    const connStatus = document.getElementById('connectionStatus');
    if (connStatus) {
      connStatus.className = "hidden md:flex items-center space-x-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 text-xs font-medium";
      connStatus.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Firebase tilkoblet</span>
      `;
    }

    const beregnetSkolear = getGjeldendeSkolear();
    const metaRef = firebase.database().ref('skolear_meta');

    metaRef.on('value', async (snapshot) => {
      const meta = snapshot.val();
      
      if (meta && meta.liste && meta.liste.length > 0) {
        tilgjengeligeSkolear = meta.liste;
        
        if (!tilgjengeligeSkolear.includes(beregnetSkolear)) {
          tilgjengeligeSkolear.push(beregnetSkolear);
          aktivtSkolear = beregnetSkolear;
          valgtSkolear = beregnetSkolear;
          await metaRef.set({ liste: tilgjengeligeSkolear, aktivt: beregnetSkolear });
        } else {
          aktivtSkolear = beregnetSkolear;
          if (!valgtSkolear) valgtSkolear = beregnetSkolear;
        }
      } else {
        tilgjengeligeSkolear = [beregnetSkolear];
        aktivtSkolear = beregnetSkolear;
        valgtSkolear = beregnetSkolear;
        await metaRef.set({ liste: tilgjengeligeSkolear, aktivt: beregnetSkolear });
      }

      updateSkolearDropdown();
      listenToSkolearData(valgtSkolear);
    });

  } catch (e) {
    console.error("Feil ved initiering av Firebase:", e);
    fallbackToLocalStorage();
  }
}

function listenToSkolearData(skolearNavn) {
  if (!isFirebaseActive) return;

  dbRef = firebase.database().ref(`skolear_data/${skolearNavn}/ipads`);
  
  dbRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      ipads = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
    } else {
      ipads = [];
    }
    updateKlasseFilterOptions();
    renderTable();
  }, (err) => {
    console.error("Firebase error:", err);
    showToast("Feil ved tilkobling til Firebase", "error");
    fallbackToLocalStorage();
  });

  updateArchiveStateVisually();
}

function updateSkolearDropdown() {
  const select = document.getElementById('selectSkolear');
  if (!select) return;

  select.innerHTML = '';
  tilgjengeligeSkolear.forEach(ar => {
    const opt = document.createElement('option');
    opt.value = ar;
    opt.textContent = ar + (ar === aktivtSkolear ? ' (Aktivt)' : ' (Arkiv)');
    select.appendChild(opt);
  });

  select.value = valgtSkolear;
}

function changeSkolear(nyttSkolear) {
  valgtSkolear = nyttSkolear;
  listenToSkolearData(valgtSkolear);
}

function updateArchiveStateVisually() {
  const isArchive = valgtSkolear !== aktivtSkolear;
  const banner = document.getElementById('archiveBanner');
  const btnAdd = document.getElementById('btnAddDevice');
  const labelYear = document.getElementById('archiveYearLabel');

  if (banner) {
    if (isArchive) {
      banner.classList.remove('hidden');
      if (labelYear) labelYear.textContent = valgtSkolear;
    } else {
      banner.classList.add('hidden');
    }
  }

  if (btnAdd) {
    if (isArchive) {
      btnAdd.classList.add('opacity-50', 'pointer-events-none');
    } else {
      btnAdd.classList.remove('opacity-50', 'pointer-events-none');
    }
  }
}

function fallbackToLocalStorage() {
  isFirebaseActive = false;
  const connStatus = document.getElementById('connectionStatus');
  if (connStatus) {
    connStatus.className = "hidden md:flex items-center space-x-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200 text-xs font-medium";
    connStatus.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-amber-500"></span>
      <span>Lokal modus (localStorage)</span>
    `;
  }
  const localData = localStorage.getItem('local_ipads_data');
  if (localData) {
    ipads = JSON.parse(localData);
  } else {
    ipads = INITIAL_SAMPLE_DATA;
    saveToLocalStorage();
  }
  updateKlasseFilterOptions();
  renderTable();
}

function saveToLocalStorage() {
  localStorage.setItem('local_ipads_data', JSON.stringify(ipads));
}

function updateKlasseFilterOptions() {
  const select = document.getElementById('filterTrinn');
  if (!select) return;

  const currentVal = (select.value || '').toUpperCase();
  const unikeKlasser = [...new Set(
    ipads.map(i => (i.klasse || i.trinn || '').trim().toUpperCase()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'no', { numeric: true }));

  select.innerHTML = '<option value="Alle">Alle klasser</option>';
  unikeKlasser.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k;
    select.appendChild(opt);
  });

  if (unikeKlasser.includes(currentVal)) {
    select.value = currentVal;
  }
}

// Sortering
function sortData(columnKey) {
  if (currentSortColumn === columnKey) {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumn = columnKey;
    currentSortDirection = 'asc';
  }
  updateSortIcons();
  renderTable();
}

function updateSortIcons() {
  const columns = ['etternavn', 'brukernavn', 'klasse', 'ipadnr', 'status', 'notat'];
  columns.forEach(col => {
    const icon = document.getElementById(`sortIcon-${col}`);
    if (!icon) return;
    if (col === currentSortColumn) {
      icon.className = `fa-solid ${currentSortDirection === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600'} text-xs`;
    } else {
      icon.className = "fa-solid fa-sort text-slate-300 text-[10px]";
    }
  });
}


// 2. Tabell-rendering - Korrigert for forskjøvne felter i Firebase
function renderTable() {
  const tbody = document.getElementById('ipadTableBody');
  const emptyState = document.getElementById('emptyState');
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const filterTrinn = (document.getElementById('filterTrinn')?.value || 'Alle').toUpperCase();
  const filterStatus = document.getElementById('filterStatus')?.value || 'Alle';

  if (!tbody) return;
  tbody.innerHTML = '';

  const isArchiveMode = typeof valgtSkolear !== 'undefined' && typeof aktivtSkolear !== 'undefined' && valgtSkolear !== aktivtSkolear;

  // Filtrering
  let filtered = ipads.filter(item => {
    const itemKlasseUpper = (item.klasse || item.trinn || '').trim().toUpperCase();

    const matchSearch = 
      (item.etternavn || '').toLowerCase().includes(search) ||
      (item.fornavn || '').toLowerCase().includes(search) ||
      itemKlasseUpper.toLowerCase().includes(search) ||
      (item.brukernavn || '').toLowerCase().includes(search) ||
      (item.ipadnr || '').toLowerCase().includes(search) ||
      (item.serienr || '').toLowerCase().includes(search) ||
      (item.skolested || '').toLowerCase().includes(search) ||
      (item.status || '').toLowerCase().includes(search) ||
      (item.lagtIEndpoint || '').toLowerCase().includes(search) ||
      (item.notat || '').toLowerCase().includes(search);

    const matchKlasse = filterTrinn === 'ALLE' || itemKlasseUpper === filterTrinn;
    
    const combinedText = `${item.status || ''} ${item.skolested || ''} ${item.notat || ''}`.toLowerCase();
    const isKassertOrBorte = combinedText.includes('kassert') || combinedText.includes('borte');
    const isTilgjengelig = (combinedText.includes('tilgjengelig') || combinedText.includes('lager') || (!item.etternavn && !item.fornavn)) && !isKassertOrBorte;

    let matchStatus = true;
    if (filterStatus === 'Tilgjengelig') {
      matchStatus = isTilgjengelig;
    } else if (filterStatus === 'Kassert') {
      matchStatus = isKassertOrBorte;
    } else if (filterStatus === 'I bruk') {
      matchStatus = !isTilgjengelig && !isKassertOrBorte;
    }

    return matchSearch && matchKlasse && matchStatus;
  });

  // Sortering
  filtered.sort((a, b) => {
    let valA = a[currentSortColumn] || '';
    let valB = b[currentSortColumn] || '';

    if (currentSortColumn === 'ipadnr' || currentSortColumn === 'trinn') {
      const numA = parseInt(valA, 10) || 0;
      const numB = parseInt(valB, 10) || 0;
      return currentSortDirection === 'asc' ? numA - numB : numB - numA;
    }

    const result = String(valA).localeCompare(String(valB), 'no', { numeric: true, sensitivity: 'base' });
    return currentSortDirection === 'asc' ? result : -result;
  });


// Oppdater Statistikk
  const iBrukCount = ipads.filter(i => {
    const st = `${i.status || ''} ${i.skolested || ''} ${i.notat || ''}`.toLowerCase();
    const isKassertOrBorte = st.includes('kassert') || st.includes('borte');
    return (i.etternavn || i.fornavn) && !isKassertOrBorte;
  }).length;

  const tilgjengeligCount = ipads.filter(i => {
    const st = `${i.status || ''} ${i.skolested || ''} ${i.notat || ''}`.toLowerCase();
    const isKassertOrBorte = st.includes('kassert') || st.includes('borte');
    return (st.includes('tilgjengelig') || st.includes('lager') || (!i.etternavn && !i.fornavn)) && !isKassertOrBorte;
  }).length;

  // Telle antall som er Kassert eller Borte
  const kassertBorteCount = ipads.filter(i => {
    const st = `${i.status || ''} ${i.skolested || ''} ${i.notat || ''}`.toLowerCase();
    return st.includes('kassert') || st.includes('borte');
  }).length;

  if (document.getElementById('statTotal')) document.getElementById('statTotal').innerText = ipads.length;
  if (document.getElementById('statActive')) document.getElementById('statActive').innerText = iBrukCount;
  if (document.getElementById('statAvailable')) document.getElementById('statAvailable').innerText = tilgjengeligCount;
  if (document.getElementById('statKassertBorte')) document.getElementById('statKassertBorte').innerText = kassertBorteCount;

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  } else {
    if (emptyState) emptyState.classList.add('hidden');
  }

  filtered.forEach(ipad => {
    const tr = document.createElement('tr');
    
    // RYDDEOPP I FELTENE BASERT PÅ HVA DE FAKTISK INNEHOLDER:
    
    // 1. Finn DATO: Sjekk lagtIEndpoint, skolested (da dato ligger der) og status
    let rawDato = (ipad.lagtIEndpoint || '').trim();
    if (!rawDato && /^\d{2}\.\d{2}\.\d{4}$/.test((ipad.skolested || '').trim())) {
      rawDato = ipad.skolested.trim();
    }
    if (!rawDato && /^\d{2}\.\d{2}\.\d{4}$/.test((ipad.status || '').trim())) {
      rawDato = ipad.status.trim();
    }

    // 2. Finn SKOLESTED: Sjekk notat, status og skolested
    let rawSted = '';
    const altSamlet = `${ipad.notat || ''} ${ipad.skolested || ''} ${ipad.status || ''}`;
    if (altSamlet.includes('Heståsen')) rawSted = 'Heståsen';
    else if (altSamlet.includes('Brattbakken')) rawSted = 'Brattbakken';

    // Fallback til trinn dersom usikker
    if (!rawSted) {
      const renKlasse = (ipad.klasse || ipad.trinn || '').trim().toUpperCase();
      const trinnTall = parseInt(renKlasse, 10) || 0;
      if (trinnTall >= 1 && trinnTall <= 3) rawSted = 'Heståsen';
      else if (trinnTall >= 4 && trinnTall <= 7) rawSted = 'Brattbakken';
    }

    // 3. Finn REELT NOTAT (tøm dersom det kun var skolested/dato som lå i notat-feltet)
    let rawNotat = (ipad.notat || '').trim();
    if (rawNotat === 'Heståsen' || rawNotat === 'Brattbakken' || rawNotat === rawDato) {
      rawNotat = '';
    } else {
      rawNotat = rawNotat.replace('Heståsen', '').replace('Brattbakken', '').replace(rawDato, '').trim();
    }

    const rawStatus = (ipad.status || '').trim();
    const combinedText = `${rawStatus} ${rawSted} ${rawNotat}`.toLowerCase();

    let bgClass = "hover:bg-slate-50/70";
    let statusBadgeClass = "bg-slate-100 text-slate-700 border-slate-200";
    let badgeHTML = "";

    // Tilstander
    if (combinedText.includes('kassert')) {
      bgClass = "bg-red-50/50 hover:bg-red-50/80";
      statusBadgeClass = "bg-red-100 text-red-800 border-red-300 px-3 py-1";
      badgeHTML = `<span class="font-medium">Kassert</span>`;
    } else if (combinedText.includes('borte')) {
      bgClass = "bg-red-50/50 hover:bg-red-50/80";
      statusBadgeClass = "bg-red-100 text-red-800 border-red-300 px-3 py-1";
      badgeHTML = `<span class="font-medium">Borte</span>`;
    } else if (combinedText.includes('tilgjengelig') || combinedText.includes('lager') || (!ipad.etternavn && !ipad.fornavn)) {
      bgClass = "bg-emerald-50/60 hover:bg-emerald-100/60";
      statusBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300 px-3 py-1";
      badgeHTML = `<span class="font-medium">Tilgjengelig</span>`;
    } else {
      bgClass = "hover:bg-amber-50/40";
      
      const stedLower = rawSted.toLowerCase();
      let datoTekstFarge = "text-amber-900";
      let stedTekstFarge = "text-amber-700";

      if (stedLower.includes('heståsen')) {
        statusBadgeClass = "bg-amber-100/80 text-amber-900 border-amber-300 px-3 py-1";
        datoTekstFarge = "text-amber-950";
        stedTekstFarge = "text-amber-800 font-semibold";
      } else if (stedLower.includes('brattbakken')) {
        statusBadgeClass = "bg-sky-100/80 text-sky-900 border-sky-300 px-3 py-1";
        datoTekstFarge = "text-sky-950";
        stedTekstFarge = "text-sky-800 font-semibold";
      } else {
        statusBadgeClass = "bg-amber-50 text-amber-900 border-amber-200/80 px-3 py-1";
      }
      
      const stedVisning = rawSted || 'I bruk';
      
      if (rawDato) {
        badgeHTML = `
          <div class="flex flex-col items-center leading-tight py-0.5">
            <span class="font-semibold text-xs ${datoTekstFarge}">${rawDato}</span>
            <span class="text-[10px] ${stedTekstFarge} mt-0.5">${stedVisning}</span>
          </div>
        `;
      } else {
        badgeHTML = `<span class="font-medium ${stedTekstFarge}">${stedVisning}</span>`;
      }
    }

    tr.className = `${bgClass} transition border-b border-slate-100 text-xs sm:text-sm`;

    const funnetModell = typeof finnIPad === 'function' ? finnIPad(ipad.serienr) : null;
    
    let enhetsVisning = `<span class="font-bold text-indigo-600">${ipad.ipadnr || '-'}</span>`;
    if (funnetModell) {
      enhetsVisning += ` <span class="text-xs text-slate-500 font-normal">(${funnetModell})</span>`;
    }
    if (ipad.serienr) {
      enhetsVisning += `<div class="text-[11px] font-mono text-slate-400 font-normal">${ipad.serienr}</div>`;
    } else {
      enhetsVisning += `<div class="text-[11px] italic text-slate-300 font-normal">Mangler serienr</div>`;
    }

    const renKlasse = (ipad.klasse || ipad.trinn || '-').trim().toUpperCase();

    const actionButtons = isArchiveMode 
      ? `<span class="text-xs italic text-slate-400">Arkivert</span>`
      : `
        <button onclick="editDevice('${ipad.id}')" class="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition" title="Rediger">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button onclick="deleteDevice('${ipad.id}')" class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition" title="Slett">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      `;

    tr.innerHTML = `
      <td class="py-3 px-4 font-semibold text-slate-900">
        ${ipad.etternavn || ipad.fornavn ? `${ipad.etternavn}, ${ipad.fornavn}` : '<span class="text-slate-400 italic">Ikke tildelt</span>'}
      </td>
      <td class="py-3 px-4 font-mono text-slate-600 font-medium">
        ${ipad.brukernavn ? ipad.brukernavn : '-'}
      </td>
      <td class="py-3 px-4">
        ${renKlasse !== '' && renKlasse !== '-' ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">${renKlasse}</span>` : '-'}
      </td>
      <td class="py-3 px-4 leading-snug">
        ${enhetsVisning}
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center justify-center rounded-xl text-xs border ${statusBadgeClass}">
          ${badgeHTML}
        </span>
      </td>
      <td class="py-3 px-4 text-slate-500 max-w-xs truncate" title="${rawNotat}">
        ${rawNotat || '-'}
      </td>
      <td class="py-3 px-4 text-right space-x-1 whitespace-nowrap">
        ${actionButtons}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. Lagre eller Oppdatere Enhet
async function handleSaveDevice(e) {
  e.preventDefault();
  if (valgtSkolear !== aktivtSkolear) {
    showToast("Kan ikke endre i historisk arkiv", "error");
    return;
  }

  const id = document.getElementById('editDeviceId').value;
  const deviceData = {
    etternavn: document.getElementById('inputEtternavn').value,
    fornavn: document.getElementById('inputFornavn').value,
    trinn: document.getElementById('inputTrinn').value,
    klasse: document.getElementById('inputKlasse').value,
    brukernavn: document.getElementById('inputBrukernavn').value,
    ipadnr: document.getElementById('inputIpadnr').value,
    serienr: document.getElementById('inputSerienr').value,
    lagtIEndpoint: document.getElementById('inputLagtIEndpoint').value,
    skolested: document.getElementById('inputSkolested') ? document.getElementById('inputSkolested').value : '',
    status: document.getElementById('inputStatus').value,
    notat: document.getElementById('inputNotat').value,
    oppdatert: new Date().toISOString()
  };

  if (isFirebaseActive && dbRef) {
    try {
      if (id) {
        await dbRef.child(id).update(deviceData);
      } else {
        await dbRef.push(deviceData);
      }
      showToast("Lagret i Firebase!", "success");
    } catch (err) {
      console.error("Firebase save error:", err);
      showToast("Feil ved lagring i skyen", "error");
    }
  } else {
    if (id) {
      const idx = ipads.findIndex(item => item.id === id);
      if (idx !== -1) ipads[idx] = { id, ...deviceData };
    } else {
      ipads.push({ id: Date.now().toString(), ...deviceData });
    }
    saveToLocalStorage();
    updateKlasseFilterOptions();
    renderTable();
    showToast("Lagret i lokal datatabell", "success");
  }

  closeDeviceModal();
}

// 4. Rediger og Slett
function editDevice(id) {
  if (valgtSkolear !== aktivtSkolear) {
    showToast("Kan ikke redigere i historisk arkiv", "error");
    return;
  }

  const ipad = ipads.find(item => item.id === id);
  if (!ipad) return;

  let rawDato = (ipad.lagtIEndpoint || '').trim();
  let rawSted = (ipad.skolested || '').trim();
  let rawStatus = (ipad.status || '').trim();
  let rawNotat = (ipad.notat || '').trim();

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(rawStatus)) {
    rawDato = rawStatus;
    rawStatus = 'I bruk';
  }
  if (!rawSted && (rawNotat.includes('Heståsen') || rawNotat.includes('Brattbakken'))) {
    rawSted = rawNotat;
    rawNotat = '';
  }

  document.getElementById('editDeviceId').value = ipad.id;
  document.getElementById('inputEtternavn').value = ipad.etternavn || '';
  document.getElementById('inputFornavn').value = ipad.fornavn || '';
  document.getElementById('inputTrinn').value = ipad.trinn || '';
  document.getElementById('inputKlasse').value = ipad.klasse || '';
  document.getElementById('inputBrukernavn').value = ipad.brukernavn || '';
  document.getElementById('inputIpadnr').value = ipad.ipadnr || '';
  document.getElementById('inputSerienr').value = ipad.serienr || '';
  document.getElementById('inputLagtIEndpoint').value = rawDato;
  
  if (document.getElementById('inputSkolested')) {
    document.getElementById('inputSkolested').value = rawSted;
  }
  
  document.getElementById('inputStatus').value = rawStatus || 'I bruk';
  document.getElementById('inputNotat').value = rawNotat;

  document.getElementById('modalTitle').innerText = "Rediger iPad";
  openDeviceModal();
}

async function deleteDevice(id) {
  if (valgtSkolear !== aktivtSkolear) {
    showToast("Kan ikke slette i historisk arkiv", "error");
    return;
  }

  if (!confirm("Er du sikker på at du vil slette denne enheten?")) return;

  if (isFirebaseActive && dbRef) {
    try {
      await dbRef.child(id).remove();
      showToast("Slettet fra Firebase", "success");
    } catch (err) {
      showToast("Feil ved sletting", "error");
    }
  } else {
    ipads = ipads.filter(item => item.id !== id);
    saveToLocalStorage();
    updateKlasseFilterOptions();
    renderTable();
    showToast("Slettet fra lokal liste", "success");
  }
}

// 5. CSV Import / Eksport
function exportToCSV() {
  if (ipads.length === 0) {
    showToast("Ingen data å eksportere", "error");
    return;
  }

  const headers = ["Etternavn", "Fornavn", "Trinn", "Klasse", "Brukernavn", "iPadnr.", "Serienr.", "Lagt i Endpoint", "Status", "Notat"];
  const rows = ipads.map(i => [
    `"${i.etternavn || ''}"`,
    `"${i.fornavn || ''}"`,
    `"${i.trinn || ''}"`,
    `"${i.klasse || ''}"`,
    `"${i.brukernavn || ''}"`,
    `"${i.ipadnr || ''}"`,
    `"${i.serienr || ''}"`,
    `"${i.lagtIEndpoint || ''}"`,
    `"${i.skolested || i.status || ''}"`,
    `"${(i.notat || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `ipad_register_${valgtSkolear}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function importCSV(event) {
  if (valgtSkolear !== aktivtSkolear) {
    showToast("Kan ikke importere til et historisk arkiv!", "error");
    return;
  }

  const file = event.target.files[0];
  if (!file) return;

  const replaceExisting = confirm(
    "Vil du overskrive eksisterende data i det aktive skoleåret?\n\n" +
    "Trykk 'OK' for å erstatte alt med filen du laster opp.\n" +
    "Trykk 'Avbryt' for å legge til de nye radene i tillegg til det du har."
  );

  const reader = new FileReader();
  
  reader.onload = async function(e) {
    let text = e.target.result;

    if (text.includes('')) {
      const secondReader = new FileReader();
      secondReader.onload = function(evt) {
        prosesserCSVTekst(evt.target.result, replaceExisting, event);
      };
      secondReader.readAsText(file, "ISO-8859-1");
    } else {
      prosesserCSVTekst(text, replaceExisting, event);
    }
  };

  reader.readAsText(file, "UTF-8");
}

async function prosesserCSVTekst(text, replaceExisting, event) {
  const lines = text.split(/\r?\n/);
  let importedCount = 0;

  if (replaceExisting) {
    if (isFirebaseActive && dbRef) {
      await dbRef.remove();
    } else {
      ipads = [];
      saveToLocalStorage();
    }
  }

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const delimiter = lines[i].includes(';') ? ';' : ',';
    const cols = lines[i].split(delimiter).map(col => col.replace(/^"|"$/g, '').trim());

    if (cols.length >= 2) {
      const etternavn = cols[0] || '';
      const fornavn = cols[1] || '';
      const col7 = cols[7] || ''; 
      const col8 = cols[8] || ''; 
      const col9 = cols[9] || ''; 

      let beregnetStatus = 'I bruk';
      if (col8.toLowerCase().includes('kassert')) beregnetStatus = 'Kassert';
      else if (col8.toLowerCase().includes('borte')) beregnetStatus = 'Borte';
      else if (col8.toLowerCase().includes('tilgjengelig') || (!etternavn && !fornavn)) beregnetStatus = 'Tilgjengelig';

      const råKlasse = cols[3] || cols[2] || '';
      const formatertKlasse = råKlasse.toUpperCase();

      const newObj = {
        etternavn: etternavn,
        fornavn: fornavn,
        trinn: cols[2] || '',
        klasse: formatertKlasse,
        brukernavn: cols[4] || '',
        ipadnr: cols[5] || '',
        serienr: cols[6] || '',
        lagtIEndpoint: col7,
        skolested: col8,
        status: beregnetStatus,
        notat: col9
      };

      if (isFirebaseActive && dbRef) {
        dbRef.push(newObj);
      } else {
        ipads.push({ id: Date.now().toString() + i, ...newObj });
      }
      importedCount++;
    }
  }

  if (!isFirebaseActive) {
    saveToLocalStorage();
    updateKlasseFilterOptions();
    renderTable();
  }
  
  showToast(`Importerte ${importedCount} rader fra CSV!`, "success");
  event.target.value = '';
}

// 6. Rapport og Utskrift
function openReportModal() {
  const selectKlasse = document.getElementById('reportFilterKlasse');
  if (selectKlasse) {
    const unikeKlasser = [...new Set(
      ipads.map(i => (i.klasse || i.trinn || '').trim().toUpperCase()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'no', { numeric: true }));

    selectKlasse.innerHTML = '<option value="Alle">Alle klasser</option>';
    unikeKlasser.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      selectKlasse.appendChild(opt);
    });
  }

  const modal = document.getElementById('reportModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeReportModal() {
  const modal = document.getElementById('reportModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function generatePrintReport() {
  const selectedKlasse = (document.getElementById('reportFilterKlasse')?.value || 'ALLE').toUpperCase();
  const selectedStatus = document.getElementById('reportFilterStatus')?.value || 'Alle';
  const selectedSted = document.getElementById('reportFilterSted')?.value || 'Alle';
  const customTitle = document.getElementById('reportTitleInput')?.value.trim() || `iPad Statusrapport (${valgtSkolear})`;

  const showElev = document.getElementById('colElev')?.checked;
  const showBrukernavn = document.getElementById('colBrukernavn')?.checked;
  const showKlasse = document.getElementById('colKlasse')?.checked;
  const showEnhet = document.getElementById('colEnhet')?.checked;
  const showSerienr = document.getElementById('colSerienr')?.checked;
  const showStatus = document.getElementById('colStatus')?.checked;
  const showNotat = document.getElementById('colNotat')?.checked;

  let reportData = ipads.filter(item => {
    const itemKlasseUpper = (item.klasse || item.trinn || '').trim().toUpperCase();
    const combinedText = `${item.status || ''} ${item.skolested || ''} ${item.notat || ''}`.toLowerCase();
    
    const isKassertOrBorte = combinedText.includes('kassert') || combinedText.includes('borte');
    const isTilgjengelig = (combinedText.includes('tilgjengelig') || combinedText.includes('lager') || (!item.etternavn && !item.fornavn)) && !isKassertOrBorte;

    const matchKlasse = selectedKlasse === 'ALLE' || itemKlasseUpper === selectedKlasse;

    let matchStatus = true;
    if (selectedStatus === 'Tilgjengelig') matchStatus = isTilgjengelig;
    else if (selectedStatus === 'Kassert') matchStatus = isKassertOrBorte;
    else if (selectedStatus === 'I bruk') matchStatus = !isTilgjengelig && !isKassertOrBorte;

    let matchSted = true;
    if (selectedSted !== 'Alle') {
      matchSted = combinedText.includes(selectedSted.toLowerCase());
    }

    return matchKlasse && matchStatus && matchSted;
  });

  reportData.sort((a, b) => (parseInt(a.ipadnr, 10) || 0) - (parseInt(b.ipadnr, 10) || 0));

  const printWindow = window.open('', '_blank');
  const todayStr = new Date().toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let tableHeaderHTML = '<tr>';
  if (showElev) tableHeaderHTML += '<th style="text-align:left; padding:8px; border-bottom:2px solid #ddd;">Elev / Bruker</th>';
  if (showBrukernavn) tableHeaderHTML += '<th style="text-align:left; padding:8px; border-bottom:2px solid #ddd;">Brukernavn</th>';
  if (showKlasse) tableHeaderHTML += '<th style="text-align:left; padding:8px; border-bottom:2px solid #ddd;">Klasse</th>';
  if (showEnhet) tableHeaderHTML += '<th style="text-align:left; padding:8px; border-bottom:2px solid #ddd;">iPad ID</th>';
  if (showSerienr) tableHeaderHTML += '<th style="text-align:left; padding:8px; border-bottom:2px solid #ddd;">Serienr / Modell</th>';
  if (showStatus) tableHeaderHTML += '<th style="text-align:left; padding:8px; border-bottom:2px solid #ddd;">Status / Sted</th>';
  if (showNotat) tableHeaderHTML += '<th style="text-align:left; padding:8px; border-bottom:2px solid #ddd;">Notat</th>';
  tableHeaderHTML += '</tr>';

  let tableRowsHTML = '';
  reportData.forEach((ipad, index) => {
    const funnetModell = typeof finnIPad === 'function' ? finnIPad(ipad.serienr) : null;
    const modellStr = funnetModell ? ` (${funnetModell})` : '';
    const renKlasse = (ipad.klasse || ipad.trinn || '-').trim().toUpperCase();

    const rawDato = (ipad.lagtIEndpoint || '').trim();
    const rawSted = (ipad.skolested || ipad.status || '').trim();
    const statusVisning = rawDato ? `${rawDato} - ${rawSted}` : rawSted;

    const rowBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';

    tableRowsHTML += `<tr style="background-color:${rowBg}; border-bottom:1px solid #eee;">`;
    if (showElev) tableRowsHTML += `<td style="padding:8px; font-weight:600;">${ipad.etternavn || ipad.fornavn ? `${ipad.etternavn}, ${ipad.fornavn}` : 'Ikke tildelt'}</td>`;
    if (showBrukernavn) tableRowsHTML += `<td style="padding:8px; font-family:monospace;">${ipad.brukernavn || '-'}</td>`;
    if (showKlasse) tableRowsHTML += `<td style="padding:8px;">${renKlasse}</td>`;
    if (showEnhet) tableRowsHTML += `<td style="padding:8px; font-weight:bold; color:#4f46e5;">iPad #${ipad.ipadnr || '-'}</td>`;
    if (showSerienr) tableRowsHTML += `<td style="padding:8px; font-size:12px;">${ipad.serienr || '-'}${modellStr}</td>`;
    if (showStatus) tableRowsHTML += `<td style="padding:8px;">${statusVisning || 'Tilgjengelig'}</td>`;
    if (showNotat) tableRowsHTML += `<td style="padding:8px; font-size:12px; color:#666;">${ipad.notat || '-'}</td>`;
    tableRowsHTML += '</tr>';
  });

  const printDocumentHTML = `
    <!DOCTYPE html>
    <html lang="no">
    <head>
      <meta charset="UTF-8">
      <title>${customTitle}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #1e293b; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 20px; color: #0f172a; }
        .header p { margin: 3px 0 0 0; color: #64748b; font-size: 12px; }
        .info-bar { display: flex; gap: 20px; background: #f8fafc; padding: 10px 15px; border-radius: 8px; font-size: 12px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; }
        th { font-size: 11px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; }
        td { font-size: 12px; }
        .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: flex-end; gap: 10px;">
        <button onclick="window.close()" style="background:#e2e8f0; color:#334155; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">
          Lukk
        </button>
        <button onclick="window.print()" style="background:#4f46e5; color:white; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">
          Skriv ut / Lagre som PDF
        </button>
      </div>

      <div class="header">
        <div>
          <h1>${customTitle}</h1>
          <p>iPad Inventar- og Databasestyring - Skoleår: ${valgtSkolear}</p>
        </div>
        <div style="text-align: right;">
          <p>Dato: <strong>${todayStr}</strong></p>
        </div>
      </div>

      <div class="info-bar">
        <div><strong>Klasse:</strong> ${selectedKlasse === 'ALLE' ? 'Alle' : selectedKlasse}</div>
        <div><strong>Status:</strong> ${selectedStatus}</div>
        <div><strong>Skolested:</strong> ${selectedSted}</div>
        <div><strong>Antall enheter:</strong> ${reportData.length}</div>
      </div>

      <table>
        <thead>${tableHeaderHTML}</thead>
        <tbody>${tableRowsHTML}</tbody>
      </table>

      <div class="footer">
        Generert automatisk fra iPad Register (${valgtSkolear})
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(printDocumentHTML);
  printWindow.document.close();
  closeReportModal();
}

// 7. Skoleårsbytte med Klasseopprykk
function openNewYearModal() {
  const modal = document.getElementById('newYearModal');
  const inputName = document.getElementById('inputNewSkolearName');
  
  const splitted = aktivtSkolear.split('-');
  if (splitted.length === 2) {
    const startAr = parseInt(splitted[0], 10) + 1;
    const sluttAr = parseInt(splitted[1], 10) + 1;
    if (inputName) inputName.value = `${startAr}-${sluttAr}`;
  } else {
    if (inputName) inputName.value = '2027-2028';
  }

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeNewYearModal() {
  const modal = document.getElementById('newYearModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function executeStartNewYear() {
  const nyttSkolearNavn = document.getElementById('inputNewSkolearName').value.trim();
  const metodedel = document.querySelector('input[name="newYearMethod"]:checked')?.value || 'opprykk';

  if (!nyttSkolearNavn) {
    showToast("Vennligst oppgi navn på nytt skoleår", "error");
    return;
  }

  if (tilgjengeligeSkolear.includes(nyttSkolearNavn)) {
    showToast("Dette skoleåret finnes allerede!", "error");
    return;
  }

  let nyeIpads = [];

  if (metodedel === 'opprykk') {
    nyeIpads = ipads.map(item => {
      let k = (item.klasse || '').trim().toUpperCase();
      let nyKlasse = k;
      let nyEtternavn = item.etternavn;
      let nyFornavn = item.fornavn;
      let nyBrukernavn = item.brukernavn;
      let nyStatus = item.status || 'I bruk';

      const match = k.match(/^(\d+)([A-Z]*)$/);
      if (match) {
        const tall = parseInt(match[1], 10);
        const bokstav = match[2];

        if (tall >= 7) {
          nyKlasse = '';
          nyEtternavn = '';
          nyFornavn = '';
          nyBrukernavn = '';
          nyStatus = 'Tilgjengelig';
        } else {
          nyKlasse = `${tall + 1}${bokstav}`;
        }
      }

      return {
        etternavn: nyEtternavn,
        fornavn: nyFornavn,
        trinn: item.trinn,
        klasse: nyKlasse,
        brukernavn: nyBrukernavn,
        ipadnr: item.ipadnr,
        serienr: item.serienr,
        lagtIEndpoint: item.lagtIEndpoint,
        skolested: item.skolested,
        status: nyStatus,
        notat: item.notat
      };
    });
  } else {
    nyeIpads = ipads.map(item => ({
      etternavn: '',
      fornavn: '',
      trinn: '',
      klasse: '',
      brukernavn: '',
      ipadnr: item.ipadnr,
      serienr: item.serienr,
      lagtIEndpoint: item.lagtIEndpoint,
      skolested: item.skolested,
      status: 'Tilgjengelig',
      notat: item.notat
    }));
  }

  if (isFirebaseActive) {
    try {
      const targetRef = firebase.database().ref(`skolear_data/${nyttSkolearNavn}/ipads`);
      for (const obj of nyeIpads) {
        await targetRef.push(obj);
      }

      const nyListe = [...tilgjengeligeSkolear, nyttSkolearNavn];
      await firebase.database().ref('skolear_meta').set({
        liste: nyListe,
        aktivt: nyttSkolearNavn
      });

      valgtSkolear = nyttSkolearNavn;
      showToast(`Opprettet og byttet til skoleår ${nyttSkolearNavn}!`, "success");
      closeNewYearModal();

    } catch (err) {
      console.error("Feil ved oprettelse av nytt skoleår:", err);
      showToast("Kunne ikke opprette nytt skoleår", "error");
    }
  } else {
    showToast("Skoleårsbytte krever Firebase-tilkobling", "error");
  }
}

// Modal Helpers
function openDeviceModal() {
  document.getElementById('deviceModal').classList.remove('hidden');
  document.getElementById('deviceModal').classList.add('flex');
}

function closeDeviceModal() {
  document.getElementById('deviceModal').classList.add('hidden');
  document.getElementById('deviceModal').classList.remove('flex');
  document.getElementById('deviceForm').reset();
  document.getElementById('editDeviceId').value = '';
  document.getElementById('modalTitle').innerText = "Legg til ny iPad";
}

function openHelpModal() {
  document.getElementById('helpModal').classList.remove('hidden');
  document.getElementById('helpModal').classList.add('flex');
}

function closeHelpModal() {
  document.getElementById('helpModal').classList.add('hidden');
  document.getElementById('helpModal').classList.remove('flex');
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `fixed top-5 right-5 z-50 transition-all duration-300 px-4 py-3 rounded-xl shadow-lg flex items-center space-x-3 text-sm font-medium ${
    type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
  }`;
  toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i> <span>${message}</span>`;
  toast.style.transform = 'translateY(0)';
  toast.style.opacity = '1';

  setTimeout(() => {
    toast.style.transform = 'translateY(-100px)';
    toast.style.opacity = '0';
  }, 3000);
}

// Lytte på Firebase Auth-status
window.addEventListener('DOMContentLoaded', () => {
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged((user) => {
      const btnLogin = document.getElementById('btnLogin');
      const userInfo = document.getElementById('userInfo');
      const emailLabel = document.getElementById('userEmailLabel');
      const btnAddDevice = document.getElementById('btnAddDevice');
      const btnNewYear = document.getElementById('btnNewYear');

      // Liste over godkjente e-postadresser
      const godkjenteBrukere = ['77tor@ikrs.no', 'tor.skarprud@gmail.com'];
      const isAuthorized = user && godkjenteBrukere.includes(user.email);

      if (isAuthorized) {
        // Logget inn og godkjent: Skjul innloggingsknapp, vis brukerinfo
        if (btnLogin) btnLogin.classList.add('hidden');
        if (userInfo) userInfo.classList.remove('hidden');
        if (emailLabel) emailLabel.textContent = user.email;
        
        // Aktiver handlinger for innloggede brukere
        if (btnAddDevice) btnAddDevice.style.display = 'inline-flex';
        if (btnNewYear) btnNewYear.style.display = 'inline-block';

        // Start tilkobling og dataletting NÅ som innloggingen er verifisert
        initDatabase();
      } else {
        // Utlogget eller uautorisert e-post: Vis innloggingsknapp, skjul brukerinfo
        if (btnLogin) btnLogin.classList.remove('hidden');
        if (userInfo) userInfo.classList.add('hidden');
        if (emailLabel) emailLabel.textContent = '';
        
        // Skjul redigeringsknapper når man ikke har tilgang
        if (btnAddDevice) btnAddDevice.style.display = 'none';
        if (btnNewYear) btnNewYear.style.display = 'none';

        // Tøm dataene slik at tabellen blir blank for uinloggede
        ipads = [];
        renderTable();

        if (user && !isAuthorized) {
          if (typeof showToast === 'function') showToast("Kontoen har ikke tilgang til databasen.", "error");
        }
      }
    });
  }
});

// Logg inn med Google Pop-up
async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await firebase.auth().signInWithPopup(provider);
    if (typeof showToast === 'function') showToast("Innlogget med Google!", "success");
  } catch (error) {
    console.error("Google innloggingsfeil:", error);
    if (typeof showToast === 'function') showToast("Kunne ikke logge inn med Google", "error");
  }
}

// Logg ut
async function handleLogout() {
  try {
    await firebase.auth().signOut();
    if (typeof showToast === 'function') showToast("Du er nå logget ut", "success");
  } catch (error) {
    console.error("Utloggingsfeil:", error);
  }
}