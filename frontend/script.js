const API_BASE = "http://127.0.0.1:8000";

// Состояние приложения
let currentCategory = "все";
let allPlacesCache = [];
let markersLayer = L.layerGroup();
let routePolyline = null;

// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ КАРТЫ LEAFLET
// ==========================================
const map = L.map('map', { zoomControl: false }).setView([42.55, 47.15], 8);
L.control.zoom({ position: 'bottomright' }).addTo(map);
markersLayer.addTo(map);

const mapLayers = {
    ethno: L.tileLayer('https://{s}://{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap'
    }),
    relief: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap'
    }),
    satellite: L.tileLayer('https://arcgisonline.com{z}/{y}/{x}', {
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

// Отрисовка меток на карте из массива объектов БД
function renderMarkersOnMap(placesList) {
    markersLayer.clearLayers();

    placesList.forEach(place => {
        if (place.lat && place.lon) {
            const marker = L.marker([place.lat, place.lon]);
            const priceText = place.price ? ` • <b>${place.price} ₽</b>` : '';
            const ratingText = place.rating ? ` ★ ${place.rating}` : '';

            marker.bindPopup(`
                <strong>${place.name}</strong><br>
                <span style="font-size:11px; color:#555;">Категория: ${place.category || 'место'}${ratingText}${priceText}</span><br>
                <p style="font-size:12px; margin-top:4px;">${place.description ? place.description.slice(0, 90) + '...' : ''}</p>
            `);

            marker.on('click', () => {
                document.getElementById('mapStatus').innerHTML = `📍 <strong>${place.name}</strong> (${place.category || 'локация'})${priceText}`;
                checkAndShowHistoryFact(place.name + " " + (place.description || ""));
            });

            marker.addTo(markersLayer);
        }
    });
}

// Отрисовка линии маршрута из поля route_coords ("42.98,47.50|43.05,46.85")
function drawRouteOnMap(place) {
    if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
    }

    if (place.route_coords && place.route_coords.includes('|')) {
        const points = place.route_coords.split('|').map(pair => {
            const [lat, lon] = pair.split(',').map(Number);
            return [lat, lon];
        }).filter(pt => !isNaN(pt) && !isNaN(pt));

        if (points.length > 1) {
            routePolyline = L.polyline(points, {
                color: '#B82925',
                weight: 5,
                opacity: 0.85,
                dashArray: '10, 6'
            }).addTo(map);

            map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
            document.getElementById('mapStatus').innerHTML = `🧭 Маршрут «<strong>${place.name}</strong>» построен на карте (${points.length} точек)`;
            return;
        }
    }

    // Если route_coords нет, просто летим к одиночной точке lat/lon
    if (place.lat && place.lon) {
        map.flyTo([place.lat, place.lon], 13, { duration: 1.3 });
        document.getElementById('mapStatus').innerHTML = `📍 Точка: <strong>${place.name}</strong>`;
    }
}

// ==========================================
// 2. ЗАГРУЗКА ДАННЫХ С БЭКЕНДА (FastAPI)
// ==========================================

async function initApp() {
    await Promise.all([
        loadCategories(),
        loadAllPlaces(),
        loadLastQueries(),
        loadExcursions()
    ]);
}

// 2.1 Загрузка категорий для верхнего меню (GET /api/categories)
async function loadCategories() {
    try {
        const res = await fetch(`${API_BASE}/api/categories`);
        const categories = await res.json();
        const nav = document.getElementById('categoriesNav');

        nav.innerHTML = categories.map(cat => `
            <button class="nav-tab ${cat === currentCategory ? 'active' : ''}" 
                    onclick="selectCategory('${cat}', this)">
                ${cat}
            </button>
        `).join('');
    } catch (err) {
        console.warn("Не удалось загрузить категории с сервера, оставлены стандартные:", err);
    }
}

// 2.2 Загрузка всех мест для карты (GET /api/places)
async function loadAllPlaces() {
    try {
        const res = await fetch(`${API_BASE}/api/places`);
        allPlacesCache = await res.json();
        renderMarkersOnMap(allPlacesCache);
        document.getElementById('mapStatus').innerHTML = `✅ Загружено объектов на карту: <strong>${allPlacesCache.length}</strong>`;
    } catch (err) {
        console.error("Ошибка загрузки /api/places:", err);
        document.getElementById('mapStatus').innerHTML = `⚠️ Сервер 127.0.0.1:8000 недоступен. Запустите FastAPI (uvicorn).`;
    }
}

// 2.3 Загрузка экскурсий (GET /api/excursions или ?days=...)
async function loadExcursions(days = null) {
    try {
        let url = `${API_BASE}/api/excursions`;
        if (days !== null) {
            url += `?days=${days}`;
        }
        const res = await fetch(url);
        const data = await res.json();

        document.getElementById('gridHeading').innerText = days
            ? `Экскурсии на ${days} ${days === 1 ? 'день' : 'дня'}`
            : 'Экскурсии по Дагестану';

        renderCards(data);
    } catch (err) {
        console.error("Ошибка загрузки /api/excursions:", err);
    }
}

// 2.4 Умный поиск и фильтрация по категориям (GET /api/search)
async function executeSearch(customQuery = null) {
    const inputEl = document.getElementById('searchInput');
    const queryText = customQuery !== null ? customQuery : inputEl.value.trim();

    if (customQuery !== null) {
        inputEl.value = customQuery;
    }

    // Показываем исторический факт, если ищут национальную еду или аулы
    checkAndShowHistoryFact(queryText);

    try {
        const params = new URLSearchParams();
        if (currentCategory && currentCategory !== "все") {
            params.append("category", currentCategory);
        }
        if (queryText) {
            params.append("query", queryText);
        }

        const res = await fetch(`${API_BASE}/api/search?${params.toString()}`);
        const results = await res.json();

        document.getElementById('gridHeading').innerText = queryText
            ? `Результаты по запросу «${queryText}» (${results.length})`
            : `Категория: ${currentCategory} (${results.length})`;

        renderCards(results);
        renderMarkersOnMap(results);

        // Если был текстовый запрос — обновляем блок "Последние запросы" из БД
        if (queryText) {
            loadLastQueries();
        }
    } catch (err) {
        console.error("Ошибка при поиске /api/search:", err);
    }
}

// 2.5 Загрузка последних 5 запросов из БД (GET /api/last-queries)
async function loadLastQueries() {
    const carousel = document.getElementById('recentCarousel');
    const cardColors = ['card-berry', 'card-ochre', 'card-sky'];

    try {
        const res = await fetch(`${API_BASE}/api/last-queries`);
        const queries = await res.json();

        if (!queries.length) {
            carousel.innerHTML = `<div class="recent-card card-ochre"><small>История поиска пока пуста. Введите запрос выше!</small></div>`;
            return;
        }

        carousel.innerHTML = queries.map((q, index) => {
            const colorClass = cardColors[index % cardColors.length];
            return `
                <div class="recent-card ${colorClass}" onclick="repeatRecentQuery('${q.query_text}', '${q.category || 'все'}')">
                    <span class="recent-tag">Категория: ${q.category || 'все'}</span>
                    <strong>${q.query_text}</strong>
                    <small>Повторить поиск →</small>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.warn("Не удалось загрузить /api/last-queries:", err);
    }
}

// ==========================================
// 3. ВЗАИМОДЕЙСТВИЕ С ИНТЕРФЕЙСОМ
// ==========================================

function selectCategory(category, btn) {
    currentCategory = category;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Сбрасываем активный фильтр дней
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
        tab.classList.toggle('active', tab.innerText.trim() === category);
    });
    executeSearch(queryText);
}

// Отрисовка карточек в нижнем блоке в стиле вашего макета
function renderCards(items) {
    const grid = document.getElementById('cardsGrid');
    const colors = ['card-berry', 'card-sky', 'card-ochre', 'card-berry'];

if (!items || items.length === 0) {
grid.innerHTML = <div class="empty-state">По вашему запросу ничего не найдено. Попробуйте изменить категорию или поисковое слово.</div>;
return;
}
grid.innerHTML = items.map((item, index) => {
const colorClass = colors[index % colors.length];
const daysBadge = item.days ?  • ${item.days} дн. : '';
const priceText = item.price ? ${item.price} ₽ : 'Бесплатно';
const ratingText = item.rating ? ★ ${item.rating} : '★ 4.9';
// Кодируем объект в строку для передачи в модальное окно
const itemJson = encodeURIComponent(JSON.stringify(item));
return <article class="grid-card ${colorClass}" onclick="openPlaceModal('${itemJson}')"> <div class="card-top"> <span class="card-pill">${item.category || 'Маршрут'}${daysBadge}</span> <span class="card-rating">${ratingText}</span> </div> <h3>${item.name}</h3> <p>${item.description || 'Уникальная локация Республики Дагестан.'}</p> <div class="card-footer"> <span class="price">${priceText}</span> <span class="action-link">На карту / Подробнее →</span> </div> </article>;
}).join('');
}
// ==========================================
// 4. ИСТОРИЧЕСКИЕ ФАКТЫ О НАЦИОНАЛЬНОЙ ЕДЕ
// ==========================================
const historyFacts = {
'хинкал': {
badge: '🍲 История в тарелке',
title: 'Аварский хинкал — символ единства горцев',
text: 'Не путать с грузинскими хинкали! В Дагестане это вареные в мясном бульоне кусочки теста, которые подаются отдельно от мяса с чесночным соусом и пиалой бульона. У каждого из 30 народов республики — свой способ лепки.'
},
'чуду': {
badge: '🥟 Кулинарная традиция',
title: 'Даргинское чуду — закрытый пирог с душой гор',
text: 'Тонкие лепешки с мясом, картофелем, творогом или горной зеленью (крапивой и лебедой). Чуду жарят на сухой раскаленной сковороде и щедро смазывают топленым маслом.'
},
'урбеч': {
badge: '🍯 Древний суперфуд',
title: 'Урбеч — энергия горцев на каменных жерновах',
text: 'Густая паста из перетертых сырых семян льна, тыквы или абрикосовых косточек. Горцы брали урбеч в походы через перевалы: две ложки с медом мгновенно восстанавливают силы.'
},
'курзе': {
badge: '🥟 Секреты кухни',
title: 'Курзе — дагестанские пельмени с узорной «косичкой»',
text: 'Их легко узнать по особому плетеному шву, который удерживает сочный бульон внутри. В начинку часто добавляют барбарис, грецкий орех или ароматные горные травы.'
},
'гамсутль': {
badge: '🏰 Легенды аулов',
title: 'Гамсутль — аул, высеченный прямо в скале',
text: 'В переводе с аварского означает «у подножия ханской башни». Аул был неприступной крепостью на высоте 1418 метров, куда вела лишь узкая горная тропа.'
}
};
function checkAndShowHistoryFact(text) {
if (!text) return;
const lower = text.toLowerCase();
for (const key in historyFacts) {
if (lower.includes(key)) {
const fact = historyFacts[key];
document.getElementById('factBadge').innerText = fact.badge;
document.getElementById('factTitle').innerText = fact.title;
document.getElementById('factText').innerText = fact.text;
break;
}
}
}
// ==========================================
// 5. МОДАЛЬНОЕ ОКНО, ТЕМА И ЯЗЫК
// ==========================================
function openPlaceModal(encodedItem) {
const place = JSON.parse(decodeURIComponent(encodedItem));
document.getElementById('modalCategory').innerText = ${place.category || 'Маршрут'}${place.days ? ' • ' + place.days + ' дн.' : ''};
document.getElementById('modalTitle').innerText = place.name;
document.getElementById('modalDesc').innerText = place.description || 'Описание маршрута.';
document.getElementById('modalPrice').innerText = place.price ? ${place.price} ₽ : 'Вход свободный';
const routeBox = document.getElementById('modalRouteText');
if (place.route_points) {
routeBox.style.display = 'block';
routeBox.innerHTML = <strong>Точки маршрута:</strong> ${place.route_points};
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
const isDark = document.body.classList.contains('dark-theme');
document.getElementById('toggleThumb').innerText = isDark ? '🌙' : '☀️';
}
let currentLang = 'ru';
function toggleLang() {
currentLang = currentLang === 'ru' ? 'en' : 'ru';
document.getElementById('langIndicator').innerText = currentLang.toUpperCase();
document.querySelectorAll('[data-ru]').forEach(el => {
el.innerText = el.getAttribute('data-' + currentLang);
});
}