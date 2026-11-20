const API_BASE = "http://127.0.0.1:8000";
let currentCategory = "все";
let currentItemsList = [];
let markersLayer = L.layerGroup();
let routePolyline = null;

// Инициализация карты
const map = L.map('map', { zoomControl: false }).setView([42.55, 47.15], 8);
L.control.zoom({ position: 'bottomright' }).addTo(map);
markersLayer.addTo(map);

// Слои карты (ИСПРАВЛЕНО: добавлены правильные URL)
const mapLayers = {
    ethno: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }),
    relief: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri'
    })
};
let activeTileLayer = mapLayers.ethno.addTo(map);

function setMapLayer(type, btn) {
    map.removeLayer(activeTileLayer);
    activeTileLayer = mapLayers[type].addTo(map);
    document.querySelectorAll('.layer-chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

function resetMap() {
    if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
    }
    map.flyTo([42.55, 47.15], 8);
    document.getElementById('mapStatus').innerHTML = '📍 Обзорная карта Республики Дагестан';
}

function renderMarkersOnMap(placesList) {
    markersLayer.clearLayers();
    placesList.forEach(place => {
        if (place.lat && place.lon) {
            const marker = L.marker([place.lat, place.lon]);
            const priceText = place.price ? ' • <b>' + place.price + ' ₽</b>' : '';
            const ratingText = place.rating ? ' ★ ' + place.rating : '';
            marker.bindPopup('<strong>' + place.name + '</strong><br><span style="font-size:11px;">' + (place.category || 'место') + ratingText + priceText + '</span>');
            marker.on('click', () => {
                document.getElementById('mapStatus').innerHTML = '📍 <strong>' + place.name + '</strong>' + priceText;
                checkAndShowHistoryFact(place.name + ' ' + (place.description || ''));
            });
            marker.addTo(markersLayer);
        }
    });
}

function drawRouteOnMap(place) {
    if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
    }

    // ИСПРАВЛЕНО: добавлены индексы [0] и [1] для parseFloat
    if (place.route_coords && place.route_coords.indexOf('|') !== -1) {
        const pairs = place.route_coords.split('|');
        const points = [];
        for (let i = 0; i < pairs.length; i++) {
            const parts = pairs[i].split(',');
            const lat = parseFloat(parts[0]);
            const lon = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lon)) {
                points.push([lat, lon]);
            }
        }
        if (points.length > 1) {
            routePolyline = L.polyline(points, { color: '#B82925', weight: 5, opacity: 0.85, dashArray: '10, 6' }).addTo(map);
            map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
            document.getElementById('mapStatus').innerHTML = '🧭 Маршрут «<strong>' + place.name + '</strong>» построен';
            return;
        }
    }
    // Если это не маршрут, а просто точка
    if (place.lat && place.lon) {
        map.flyTo([place.lat, place.lon], 13, { duration: 1.3 });
        document.getElementById('mapStatus').innerHTML = '📍 Точка: <strong>' + place.name + '</strong>';
    }
}

async function initApp() {
    await Promise.all([loadCategories(), loadAllPlaces(), loadLastQueries(), loadExcursions()]);
}

async function loadCategories() {
    try {
        const res = await fetch(API_BASE + '/api/categories');
        const categories = await res.json();
        const nav = document.getElementById('categoriesNav');
        nav.innerHTML = '';
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'nav-tab' + (cat === currentCategory ? ' active' : '');
            btn.innerText = cat;
            btn.onclick = () => selectCategory(cat, btn);
            nav.appendChild(btn);
        });
    } catch (err) {
        console.warn("Категории загружены из HTML");
    }
}

async function loadAllPlaces() {
    try {
        const res = await fetch(API_BASE + '/api/places');
        const data = await res.json();
        renderMarkersOnMap(data);
        document.getElementById('mapStatus').innerHTML = '✅ Подключено! Объектов на карте: <strong>' + data.length + '</strong>';
    } catch (err) {
        document.getElementById('mapStatus').innerHTML = '⚠️ Бэкенд 127.0.0.1:8000 не отвечает. Запустите uvicorn!';
    }
}

async function loadExcursions(days = null) {
    try {
        const url = days !== null ? API_BASE + '/api/excursions?days=' + days : API_BASE + '/api/excursions';
        const res = await fetch(url);
        const data = await res.json();
        document.getElementById('gridHeading').innerText = days ? 'Экскурсии на ' + days + ' дн.' : 'Экскурсии по Дагестану';
        renderCards(data);
    } catch (err) {
        document.getElementById('cardsGrid').innerHTML = '<div class="empty-state">Нет связи с сервером 127.0.0.1:8000.</div>';
    }
}

async function executeSearch(customQuery = null) {
    const inputEl = document.getElementById('searchInput');
    const queryText = customQuery !== null ? customQuery : inputEl.value.trim();
    if (customQuery !== null) inputEl.value = customQuery;

    checkAndShowHistoryFact(queryText);

    try {
        const params = new URLSearchParams();
        if (currentCategory && currentCategory !== "все") params.append("category", currentCategory);
        if (queryText) params.append("query", queryText);

        const res = await fetch(API_BASE + '/api/search?' + params.toString());
        const results = await res.json();

        document.getElementById('gridHeading').innerText = queryText
            ? 'Найдено по запросу «' + queryText + '»: ' + results.length
            : 'Категория «' + currentCategory + '»: ' + results.length;

        renderCards(results);
        renderMarkersOnMap(results);
        if (queryText) loadLastQueries();
    } catch (err) {
        console.error(err);
    }
}

async function loadLastQueries() {
    const carousel = document.getElementById('recentCarousel');
    const colors = ['card-berry', 'card-ochre', 'card-sky'];
    try {
        const res = await fetch(API_BASE + '/api/last-queries');
        const queries = await res.json();
        carousel.innerHTML = '';
        if (!queries.length) {
            carousel.innerHTML = '<div class="recent-card card-ochre"><small>История поиска пуста. Введите запрос выше!</small></div>';
            return;
        }
        queries.forEach((q, idx) => {
            const div = document.createElement('div');
            div.className = 'recent-card ' + colors[idx % colors.length];
            div.innerHTML = '<span class="recent-tag">' + (q.category || 'все') + '</span><strong>' + q.query_text + '</strong><small>Повторить поиск →</small>';
            div.onclick = () => repeatRecentQuery(q.query_text, q.category || 'все');
            carousel.appendChild(div);
        });
    } catch (err) {
        carousel.innerHTML = '<div class="recent-card card-ochre"><small>История загрузится после запуска сервера</small></div>';
    }
}

function selectCategory(category, btn) {
    currentCategory = category;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.day-chip').forEach(c => c.classList.remove('active'));

    if (category === "все" && !document.getElementById('searchInput').value.trim()) {
        loadAllPlaces();
        loadExcursions();
    } else {
        executeSearch();
    }
}

function filterByDays(days, btn) {
    document.querySelectorAll('.day-chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadExcursions(days);
}

function repeatRecentQuery(queryText, category) {
    currentCategory = category;
    document.querySelectorAll('.nav-tab').forEach(tab => {
        if (tab.innerText.trim() === category) tab.classList.add('active');
        else tab.classList.remove('active');
    });
    executeSearch(queryText);
}

function renderCards(items) {
    currentItemsList = items || [];
    const grid = document.getElementById('cardsGrid');
    const colors = ['card-berry', 'card-sky', 'card-ochre', 'card-berry'];
    grid.innerHTML = '';

    if (!currentItemsList.length) {
        grid.innerHTML = '<div class="empty-state">По вашему запросу ничего не найдено.</div>';
        return;
    }

    currentItemsList.forEach((item, idx) => {
        const article = document.createElement('article');
        article.className = 'grid-card ' + colors[idx % colors.length];
        const daysText = item.days ? ' • ' + item.days + ' дн.' : '';
        const priceText = item.price ? item.price + ' ₽' : 'Бесплатно';
        article.innerHTML =
            '<div class="card-top">' +
                '<span class="card-pill">' + (item.category || 'Маршрут') + daysText + '</span>' +
                '<span>★ ' + (item.rating || '4.9') + '</span>' +
            '</div>' +
            '<h3>' + item.name + '</h3>' +
            '<p>' + (item.description || 'Уникальная локация Республики Дагестан.') + '</p>' +
            '<div class="card-footer">' +
                '<span>' + priceText + '</span>' +
                '<span>Подробнее →</span>' +
            '</div>';
        article.onclick = () => openPlaceModal(idx);
        grid.appendChild(article);
    });
}

const historyFacts = {
    'хинкал': { badge: '🍲 История в тарелке', title: 'Аварский хинкал — символ единства горцев', text: 'Не путать с грузинскими хинкали! Это вареные в мясном бульоне кусочки теста, которые подаются отдельно от мяса с чесночным соусом и пиалой бульона.' },
    'чуду': { badge: '🥟 Кулинарная традиция', title: 'Даргинское чуду — закрытый пирог с душой гор', text: 'Тонкие лепешки с мясом, картофелем, творогом или горной зеленью, которые жарят на сухой сковороде и смазывают топленым маслом.' },
    'урбеч': { badge: '🍯 Древний суперфуд', title: 'Урбеч — энергия горцев на каменных жерновах', text: 'Густая паста из перетертых семян льна, тыквы или абрикосовых косточек, которую брали в долгие горные походы.' },
    'курзе': { badge: '🥟 Секреты кухни', title: 'Курзе — дагестанские пельмени с узорной «косичкой»', text: 'Особый плетеный шов удерживает сочный бульон внутри. В начинку добавляют барбарис, грецкий орех и горные травы.' }
};

function checkAndShowHistoryFact(text) {
    if (!text) return;
    const lower = text.toLowerCase();
    for (const key in historyFacts) {
        if (lower.indexOf(key) !== -1) {
            document.getElementById('factBadge').innerText = historyFacts[key].badge;
            document.getElementById('factTitle').innerText = historyFacts[key].title;
            document.getElementById('factText').innerText = historyFacts[key].text;
            break;
        }
    }
}

function openPlaceModal(index) {
    const place = currentItemsList[index];
    if (!place) return;
    document.getElementById('modalCategory').innerText = (place.category || 'Маршрут') + (place.days ? ' • ' + place.days + ' дн.' : '');
    document.getElementById('modalTitle').innerText = place.name;
    document.getElementById('modalDesc').innerText = place.description || '';
    document.getElementById('modalPrice').innerText = place.price ? place.price + ' ₽' : 'Вход свободный';
    const routeBox = document.getElementById('modalRouteText');
    if (place.route_points) {
        routeBox.style.display = 'block';
        routeBox.innerHTML = 'Точки маршрута: ' + place.route_points;
    } else {
        routeBox.style.display = 'none';
    }
    document.getElementById('modalMapBtn').onclick = () => {
        closeModal(null, true);
        drawRouteOnMap(place);
    };
    document.getElementById('modalOverlay').classList.add('open');
}

function closeModal(e, force) {
    if (force || (e && e.target.id === 'modalOverlay')) {
        document.getElementById('modalOverlay').classList.remove('open');
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    document.getElementById('toggleThumb').innerText = document.body.classList.contains('dark-theme') ? '🌙' : '☀️';
}

let currentLang = 'ru';
function toggleLang() {
    currentLang = currentLang === 'ru' ? 'en' : 'ru';
    document.getElementById('langIndicator').innerText = currentLang.toUpperCase();
}

document.addEventListener('DOMContentLoaded', initApp);