// --- CONSTANTS ---
const CATEGORIES = {
  infrastructure: { color: '#007aff', icon: '🏗️', label: 'Infrastructure', hex: 'var(--cat-infrastructure)', desc: 'Report damaged public property, broken bridges, or structural hazards.' },
  sanitation: { color: '#ff9500', icon: '🗑️', label: 'Sanitation', hex: 'var(--cat-sanitation)', desc: 'Report uncollected garbage, blocked drains, or overflowing community bins.' },
  safety: { color: '#ff3b30', icon: '🛡️', label: 'Safety', hex: 'var(--cat-safety)', desc: 'Report broken streetlights, missing manhole covers, or general community hazards.' },
  greenery: { color: '#34c759', icon: '🌳', label: 'Greenery', hex: 'var(--cat-greenery)', desc: 'Report fallen trees, overgrown dangerous bushes, or park maintenance issues.' },
  potholes: { color: '#af52de', icon: '🕳️', label: 'Potholes', hex: 'var(--cat-potholes)', desc: 'Report deep potholes, cracked asphalt, or severely uneven pavements on roads.' }
};

const LOCATION_DATA = {
  "India": {
    "Delhi": {
      "New Delhi": {
        "Connaught Place": [28.6304, 77.2177],
        "Chanakyapuri": [28.5959, 77.1895],
        "Vasant Vihar": [28.5603, 77.1610]
      },
      "South Delhi": {
        "Hauz Khas": [28.5494, 77.2001],
        "Saket": [28.5245, 77.2066]
      }
    },
    "Maharashtra": {
      "Mumbai": {
        "Andheri": [19.1136, 72.8697],
        "Bandra": [19.0596, 72.8295]
      },
      "Pune": {
        "Koregaon Park": [18.5362, 73.8939],
        "Viman Nagar": [18.5665, 73.9122]
      }
    },
    "Karnataka": {
      "Bengaluru": {
        "Koramangala": [12.9352, 77.6245],
        "Indiranagar": [12.9784, 77.6408]
      }
    }
  }
};

// --- UNIFIED STATE ATOM & PERSISTENCE ---
const defaultState = {
  view: 'map', // 'map' | 'kanban'
  issues: [
    { id: '1', title: 'Deep pothole causing accidents', category: 'potholes', status: 'new', lat: 28.6139, lng: 77.2090, upvotes: 42, zone: 'Central District', date: Date.now() - 100000, voted: false },
    { id: '2', title: 'Garbage dump overflow', category: 'sanitation', status: 'progress', lat: 28.6230, lng: 77.2150, upvotes: 18, zone: 'Connaught Place', date: Date.now() - 500000, voted: true },
    { id: '3', title: 'Broken street lights', category: 'safety', status: 'new', lat: 28.6050, lng: 77.2000, upvotes: 35, zone: 'South Block', date: Date.now() - 200000, voted: false },
    { id: '4', title: 'Fallen tree blocking path', category: 'greenery', status: 'resolved', lat: 28.6180, lng: 77.1950, upvotes: 89, zone: 'North Park', date: Date.now() - 900000, voted: false },
  ],
  draggedIssueId: null
};

const savedState = localStorage.getItem('polis_state');
let state = savedState ? JSON.parse(savedState) : defaultState;

if (localStorage.getItem('polis_theme') === 'light') {
  document.body.classList.add('light-theme');
}

// --- DOM ELEMENTS ---
const els = {
  mapView: document.getElementById('map-view'),
  kanbanView: document.getElementById('kanban-view'),
  
  // Kanban Elements
  columns: document.querySelectorAll('.kanban-column'),
  colNew: document.getElementById('col-new'),
  colProgress: document.getElementById('col-progress'),
  colResolved: document.getElementById('col-resolved'),
  
  // Metrics
  mTotal: document.getElementById('metric-total'),
  mRate: document.getElementById('metric-rate'),
  mZone: document.getElementById('metric-zone'),
  mCategory: document.getElementById('metric-category'),
  
  // Panel
  overlay: document.getElementById('overlay'),
  submissionPanel: document.getElementById('submission-panel'),
  closePanelBtn: document.getElementById('close-panel'),
  form: document.getElementById('issue-form'),
  draftCoords: document.getElementById('draft-coords'),
  catOptions: document.querySelectorAll('.category-option'),
  categoryDescEl: document.getElementById('category-description'),
  
  // Controls
  btnZoomIn: document.getElementById('zoom-in'),
  btnZoomOut: document.getElementById('zoom-out'),
  btnReset: document.getElementById('recenter-map'),
  btnToggleSat: document.getElementById('toggle-satellite'),
  btnLocateMe: document.getElementById('locate-me'),
  
  // Location Selectors
  selCountry: document.getElementById('select-country'),
  selState: document.getElementById('select-state'),
  selCity: document.getElementById('select-city'),
  selArea: document.getElementById('select-area'),
};

let activeCategory = 'infrastructure'; // Default form category
let isSatellite = false;
let draftLatLng = null;

// --- LEAFLET MAP INITIALIZATION ---
// Initialize map centered on India bounding box default
const lmap = L.map('map-container', { zoomControl: false }).setView([20.5937, 78.9629], 5);

// Apple Maps-style light theme tile layer (CartoDB Voyager)
const mapLayerLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(lmap);

const mapLayerSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri',
  maxZoom: 20
});

// Custom UI map controls wired to Leaflet
els.btnZoomIn.addEventListener('click', () => lmap.zoomIn());
els.btnZoomOut.addEventListener('click', () => lmap.zoomOut());
els.btnReset.addEventListener('click', () => lmap.setView([20.5937, 78.9629], 5));

els.btnToggleSat.addEventListener('click', () => {
  isSatellite = !isSatellite;
  els.btnToggleSat.classList.toggle('active', isSatellite);
  if(isSatellite) {
    els.btnToggleSat.style.color = 'var(--primary)';
    lmap.removeLayer(mapLayerLight);
    lmap.addLayer(mapLayerSat);
  } else {
    els.btnToggleSat.style.color = '';
    lmap.removeLayer(mapLayerSat);
    lmap.addLayer(mapLayerLight);
  }
});

if (els.btnLocateMe) {
  els.btnLocateMe.addEventListener('click', () => {
    if (navigator.geolocation) {
      els.btnLocateMe.style.color = 'var(--primary)';
      navigator.geolocation.getCurrentPosition(position => {
        lmap.flyTo([position.coords.latitude, position.coords.longitude], 16);
        setTimeout(() => els.btnLocateMe.style.color = '', 1000);
      }, () => {
        alert("Geolocation access denied or unavailable.");
        els.btnLocateMe.style.color = '';
      });
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  });
}

// --- LOCATION SELECTOR LOGIC ---
els.selCountry.addEventListener('change', (e) => {
  const country = e.target.value;
  els.selState.innerHTML = '<option value="" disabled selected>State</option>';
  els.selCity.innerHTML = '<option value="" disabled selected>City</option>';
  els.selArea.innerHTML = '<option value="" disabled selected>Area</option>';
  els.selCity.disabled = true; els.selArea.disabled = true;
  
  if(country && LOCATION_DATA[country]) {
    els.selState.disabled = false;
    Object.keys(LOCATION_DATA[country]).forEach(state => {
      els.selState.innerHTML += `<option value="${state}">${state}</option>`;
    });
    // Fly to India rough center
    lmap.flyTo([20.5937, 78.9629], 5);
  }
});

els.selState.addEventListener('change', (e) => {
  const country = els.selCountry.value;
  const state = e.target.value;
  els.selCity.innerHTML = '<option value="" disabled selected>City</option>';
  els.selArea.innerHTML = '<option value="" disabled selected>Area</option>';
  els.selArea.disabled = true;
  
  if(state && LOCATION_DATA[country][state]) {
    els.selCity.disabled = false;
    Object.keys(LOCATION_DATA[country][state]).forEach(city => {
      els.selCity.innerHTML += `<option value="${city}">${city}</option>`;
    });
    
    // Rough flyTo mapping for States
    if(state === 'Delhi') lmap.flyTo([28.7041, 77.1025], 10);
    if(state === 'Maharashtra') lmap.flyTo([19.7515, 75.7139], 7);
    if(state === 'Karnataka') lmap.flyTo([15.3173, 75.7139], 7);
  }
});

els.selCity.addEventListener('change', (e) => {
  const country = els.selCountry.value;
  const state = els.selState.value;
  const city = e.target.value;
  els.selArea.innerHTML = '<option value="" disabled selected>Area</option>';
  
  if(city && LOCATION_DATA[country][state][city]) {
    els.selArea.disabled = false;
    Object.keys(LOCATION_DATA[country][state][city]).forEach(area => {
      els.selArea.innerHTML += `<option value="${area}">${area}</option>`;
    });
    
    // Fly to cities
    if(city === 'New Delhi') lmap.flyTo([28.6139, 77.2090], 12);
    if(city === 'South Delhi') lmap.flyTo([28.5245, 77.2066], 12);
    if(city === 'Mumbai') lmap.flyTo([19.0760, 72.8777], 12);
    if(city === 'Pune') lmap.flyTo([18.5204, 73.8567], 12);
    if(city === 'Bengaluru') lmap.flyTo([12.9716, 77.5946], 12);
  }
});

els.selArea.addEventListener('change', (e) => {
  const country = els.selCountry.value;
  const state = els.selState.value;
  const city = els.selCity.value;
  const area = e.target.value;
  
  if(area) {
    const coords = LOCATION_DATA[country][state][city][area];
    lmap.flyTo(coords, 16);
  }
});

async function fetchAddress(lat, lng) {
  els.draftCoords.innerText = `Fetching address...`;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    if(data && data.address) {
      const road = data.address.road || data.address.suburb || data.address.neighborhood || '';
      const city = data.address.city || data.address.town || data.address.state_district || '';
      let str = '';
      if(road) str += road;
      if(road && city) str += ', ';
      if(city) str += city;
      if(!str) str = 'Custom Location';
      els.draftCoords.innerText = `📍 ${str}`;
      draftLatLng.address = str;
    } else {
      els.draftCoords.innerText = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    }
  } catch(e) {
    els.draftCoords.innerText = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
  }
}

// Map Click for Draft Pin
let draftMarker = null;
lmap.on('click', function(e) {
  draftLatLng = e.latlng;
  if(draftMarker) lmap.removeLayer(draftMarker);
  
  draftMarker = L.circleMarker(draftLatLng, {
    radius: 8, fillColor: 'var(--primary)', color: '#fff', weight: 3, fillOpacity: 1
  }).addTo(lmap);
  
  fetchAddress(draftLatLng.lat, draftLatLng.lng);
  openPanel();
});

// --- CORE RENDERER ---
function render() {
  localStorage.setItem('polis_state', JSON.stringify(state)); // Persist Data
  renderMetrics();
  renderPins();
  renderKanban();
}

// --- METRICS CALCULATION ---
function renderMetrics() {
  const total = state.issues.length;
  els.mTotal.innerText = total;
  
  const resolvedCount = state.issues.filter(i => i.status === 'resolved').length;
  const rate = total === 0 ? 0 : Math.round((resolvedCount / total) * 100);
  els.mRate.innerText = `${rate}%`;
  
  const zoneCounts = {};
  const catCounts = {};
  state.issues.forEach(i => {
    zoneCounts[i.zone] = (zoneCounts[i.zone] || 0) + 1;
    catCounts[i.category] = (catCounts[i.category] || 0) + 1;
  });
  
  const topZone = Object.entries(zoneCounts).sort((a,b)=>b[1]-a[1])[0];
  els.mZone.innerText = topZone ? topZone[0] : '-';
  
  const topCat = Object.entries(catCounts).sort((a,b)=>b[1]-a[1])[0];
  els.mCategory.innerText = topCat ? CATEGORIES[topCat[0]].label : '-';
  
  document.getElementById('count-new').innerText = state.issues.filter(i=>i.status==='new').length;
  document.getElementById('count-progress').innerText = state.issues.filter(i=>i.status==='progress').length;
  document.getElementById('count-resolved').innerText = state.issues.filter(i=>i.status==='resolved').length;
}

// --- LEAFLET PINS & HEATMAP RENDERING ---
let markers = [];
let heatCircles = [];

let searchQuery = '';
const searchInput = document.getElementById('global-search');
if(searchInput) {
  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value.toLowerCase();
    renderPins();
    renderKanban();
  });
}

function getFilteredIssues() {
  if(!searchQuery) return state.issues;
  return state.issues.filter(i => 
    i.title.toLowerCase().includes(searchQuery) || 
    (i.zone && i.zone.toLowerCase().includes(searchQuery)) ||
    (i.author && i.author.toLowerCase().includes(searchQuery))
  );
}

function renderPins() {
  // Clear existing layers
  markers.forEach(m => lmap.removeLayer(m));
  heatCircles.forEach(c => lmap.removeLayer(c));
  markers = [];
  heatCircles = [];

  const filtered = getFilteredIssues();
  filtered.forEach(issue => {
    const cat = CATEGORIES[issue.category];
    
    // 1. Render Heatmap Aura
    if(issue.status !== 'resolved') {
      const radius = 100 + (issue.upvotes * 5); // Radius in meters
      const heat = L.circle([issue.lat, issue.lng], {
        color: cat.color,
        fillColor: cat.color,
        fillOpacity: 0.15,
        weight: 0,
        radius: radius
      }).addTo(lmap);
      heatCircles.push(heat);
    }

    // 2. Render Modern Apple-style POI Marker
    const opacity = issue.status === 'resolved' ? '0.6' : '1';
    const resolvedBadge = issue.status === 'resolved' ? `<div style="position:absolute; top:-4px; right:-4px; background:#34c759; color:white; border-radius:50%; width:16px; height:16px; font-size:10px; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">✓</div>` : '';
    
    const customIcon = L.divIcon({
      html: `<div style="background: white; border: 2.5px solid ${cat.color}; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); opacity: ${opacity}; position: relative; transition: transform 0.2s;">
               <span style="font-size: 16px;">${cat.icon}</span>
               ${resolvedBadge}
             </div>`,
      className: '',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -17]
    });

    const marker = L.marker([issue.lat, issue.lng], { icon: customIcon }).addTo(lmap);
    marker.bindPopup(`<div style="font-family:-apple-system, sans-serif;">
                        <b style="font-size:14px; color:#1c1c1e;">${issue.title}</b><br>
                        <span style="color:#8e8e93; font-size:12px;">${cat.label} • ${issue.upvotes} Upvotes</span>
                      </div>`);
    markers.push(marker);
  });
}

// --- KANBAN RENDERING ---
function createCardHTML(issue) {
  const cat = CATEGORIES[issue.category];
  const votedCls = issue.voted ? 'voted' : '';
  const imgHtml = issue.image ? `<img src="${issue.image}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid rgba(255,255,255,0.2);" alt="Issue Photo">` : '';
  
  return `
    <div class="k-card" draggable="true" data-id="${issue.id}">
      <div class="k-card-header" style="margin-bottom: 0.5rem;">
        <span class="k-card-cat" style="background: ${cat.color}15; border: 1px solid ${cat.color}40; color: ${cat.color}">
          ${cat.icon} ${cat.label}
        </span>
        ${issue.status === 'resolved' ? '<span class="verified-badge">✓</span>' : ''}
      </div>
      ${imgHtml}
      <div class="k-card-title">${issue.title}</div>
      <div class="k-card-footer">
        <span class="card-zone">📍 ${issue.zone}</span>
        <button class="upvote-btn ${votedCls}" onclick="toggleUpvote('${issue.id}')">
          ▲ <span class="votes-count">${issue.upvotes}</span>
        </button>
      </div>
    </div>
  `;
}

function renderKanban() {
  const cols = { new: [], progress: [], resolved: [] };
  const filtered = getFilteredIssues();
  const sorted = [...filtered].sort((a,b) => b.upvotes - a.upvotes);
  sorted.forEach(iss => cols[iss.status].push(iss));
  
  els.colNew.innerHTML = cols.new.map(createCardHTML).join('');
  els.colProgress.innerHTML = cols.progress.map(createCardHTML).join('');
  els.colResolved.innerHTML = cols.resolved.map(createCardHTML).join('');
  
  setupDragCards();
}

window.toggleUpvote = (id) => {
  const issue = state.issues.find(i => i.id === id);
  if(!issue) return;
  if(issue.voted) { issue.upvotes--; issue.voted = false; } 
  else { issue.upvotes++; issue.voted = true; }
  render();
};

// --- DRAG AND DROP ---
function setupDragCards() {
  const cards = document.querySelectorAll('.k-card');
  cards.forEach(card => {
    card.addEventListener('dragstart', e => {
      state.draggedIssueId = card.getAttribute('data-id');
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      els.columns.forEach(c => c.classList.remove('drag-over'));
      state.draggedIssueId = null;
    });
  });
}

function initDragColumns() {
  els.columns.forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over') );
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const newStatus = col.getAttribute('data-status');
      if(state.draggedIssueId) {
        const issue = state.issues.find(i => i.id === state.draggedIssueId);
        if(issue && issue.status !== newStatus) {
          issue.status = newStatus;
          render();
        }
      }
    });
  });
}



// --- SUBMISSION PANEL ---
function openPanel() {
  els.overlay.classList.add('active');
  els.submissionPanel.classList.add('active');
}

function closePanel() {
  els.overlay.classList.remove('active');
  els.submissionPanel.classList.remove('active');
  if(draftMarker) { lmap.removeLayer(draftMarker); draftMarker = null; }
  draftLatLng = null;
  els.form.reset();
}

els.closePanelBtn.addEventListener('click', closePanel);
els.overlay.addEventListener('click', closePanel);

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'btn-add-issue') {
    // Only open panel if we are on the index page
    if(typeof lmap === 'undefined') return;
    
    const center = lmap.getCenter();
    draftLatLng = center;
    if(draftMarker) lmap.removeLayer(draftMarker);
    
    draftMarker = L.circleMarker(draftLatLng, {
      radius: 8, fillColor: 'var(--primary)', color: '#fff', weight: 3, fillOpacity: 1
    }).addTo(lmap);
    
    fetchAddress(draftLatLng.lat, draftLatLng.lng);
    openPanel();
  }
});

els.catOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    els.catOptions.forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    activeCategory = opt.getAttribute('data-cat');
    
    // Update dynamic description
    const catData = CATEGORIES[activeCategory];
    els.categoryDescEl.innerText = catData.desc;
    els.categoryDescEl.style.borderLeftColor = catData.color;
    els.categoryDescEl.style.backgroundColor = catData.color + '1A';
  });
});

els.form.addEventListener('submit', async e => {
  e.preventDefault();
  if(!draftLatLng) return;
  
  const title = document.getElementById('issue-title').value;
  const photoInput = document.getElementById('issue-photo');
  const submitBtn = els.form.querySelector('button[type="submit"]');
  
  let base64Image = null;
  // AI Verification Simulation & Image Capture
  if(photoInput && photoInput.files && photoInput.files[0]) {
    const oldTxt = submitBtn.innerText;
    submitBtn.innerHTML = '✨ AI Analyzing Photo...';
    submitBtn.disabled = true;
    
    await new Promise(r => setTimeout(r, 1500)); // Simulating 1.5s API Call
    
    const isPothole = title.toLowerCase().includes('pothole') && activeCategory === 'potholes';
    // 20% chance of AI rejection if not pothole to make it feel real
    if(!isPothole && Math.random() > 0.8) {
      alert(`AI Verification Failed: The image does not confidently match the category "${CATEGORIES[activeCategory].label}". Please provide a clearer photo.`);
      submitBtn.innerText = oldTxt;
      submitBtn.disabled = false;
      return;
    }
    
    // Read Image to Base64
    const reader = new FileReader();
    base64Image = await new Promise((resolve) => {
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(photoInput.files[0]);
    });
    
    submitBtn.innerText = oldTxt;
    submitBtn.disabled = false;
  }
  
  // Reverse geocoding placeholder - just using coordinates for zone name currently
  const zone = draftLatLng.address || `Zone ${Math.abs(Math.round(draftLatLng.lat * 100) % 100)}`;
  
  const userStr = localStorage.getItem('polis_user');
  const authorName = userStr ? JSON.parse(userStr).name : 'Anonymous Citizen';

  const newIssue = {
    id: Date.now().toString(),
    title,
    category: activeCategory,
    status: 'new',
    lat: draftLatLng.lat,
    lng: draftLatLng.lng,
    upvotes: 0,
    zone,
    date: Date.now(),
    voted: false,
    author: authorName,
    image: base64Image
  };
  
  state.issues.push(newIssue);
  closePanel();
  render();
});

// --- FEEDBACK LOGIC ---
const btnFeedback = document.getElementById('btn-feedback');
const feedbackModal = document.getElementById('feedback-modal');
const closeFeedback = document.getElementById('close-feedback');
const stars = document.querySelectorAll('.star');
let currentRating = 0;

if(btnFeedback) {
  btnFeedback.addEventListener('click', () => {
    feedbackModal.classList.toggle('active');
  });
  closeFeedback.addEventListener('click', () => {
    feedbackModal.classList.remove('active');
  });

  stars.forEach(star => {
    star.addEventListener('click', () => {
      currentRating = parseInt(star.getAttribute('data-val'));
      stars.forEach(s => {
        if(parseInt(s.getAttribute('data-val')) <= currentRating) s.classList.add('selected');
        else s.classList.remove('selected');
      });
    });
  });

  document.getElementById('feedback-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(currentRating === 0) {
      alert("Please select a star rating!");
      return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerHTML = 'Submitting...';
    btn.disabled = true;
    
    await new Promise(r => setTimeout(r, 1000));
    
    e.target.style.display = 'none';
    document.getElementById('feedback-success').classList.remove('hidden');
    
    setTimeout(() => {
      feedbackModal.classList.remove('active');
      setTimeout(() => {
        e.target.style.display = 'block';
        document.getElementById('feedback-success').classList.add('hidden');
        e.target.reset();
        stars.forEach(s => s.classList.remove('selected'));
        currentRating = 0;
        btn.innerHTML = 'Submit Feedback';
        btn.disabled = false;
      }, 500);
    }, 2000);
  });
}

// --- INIT ---
initDragColumns();
render();