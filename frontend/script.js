// 1. ИНИЦИАЛИЗАЦИЯ КАРТЫ ДАГЕСТАНА
const map = L.map('map', { zoomControl: false }).setView([42.55, 47.15], 8);
L.control.zoom({ position: 'bottomright' }).addTo(map);

const mapLayers = {
    ethno: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
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

// Точки на карте
const mapPoints = [
    { name: 'Сулакский каньон', coords: [43.0186, 46.8275], info: 'Глубина 1920 м • Смотровая площадка Дубки' },
    { name: 'Аул-призрак Гамсутль', coords: [42.3031, 46.9961], info: 'Высота 1418 м • Древний горный аул' },
    { name: 'Хунзах и водопад Тобот', coords: [42.5539, 46.7167], info: 'Водопад 70 м • Сердце Аварии' },
    { name: 'Аул Кубачи', coords: [42.0942, 47.5964], info: 'Центр художественной обработки серебра' },
    { name: 'Махачкала • Гастротур', coords: [42.9831, 47.5047], info: 'Второй рынок, хинкал, даргинское чуду' },
    { name: 'Дербент • Цитадель Нарын-Кала', coords: [42.0578, 48.2889], info: 'Древнейший город России (более 2000 лет)' }
];

mapPoints.forEach(pt => {
    const marker = L.marker(pt.coords).addTo(map);
    marker.bindPopup(`<strong>${pt.name}</strong><br><span style="font-size:12px;">${pt.info}</span>`);
    marker.on('click', () => {
        document.getElementById('mapStatus').innerHTML = `📍 Выбрано: <strong>${pt.name}</strong> — ${pt.info}`;
    });
});

function setMapLayer(type, btn) {
    map.removeLayer(activeTileLayer);
    activeTileLayer = mapLayers[type].addTo(map);
    document.querySelectorAll('.layer-chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

function flyToCoords(lat, lng, title) {
    map.flyTo([lat, lng], 13, { duration: 1.4 });
    document.getElementById('mapStatus').innerHTML = `🧭 Маршрут на карте: <strong>${title}</strong>`;
}

function resetMap() {
    map.flyTo([42.55, 47.15], 8);
    document.getElementById('mapStatus').innerHTML = '📍 Обзорная карта Республики Дагестан';
}

// 2. ИСТОРИЧЕСКИЕ ФАКТЫ О ЕДЕ И КУЛЬТУРЕ
const historyFacts = {
    'Хинкал': {
        badge: '🍲 История в тарелке',
        title: 'Аварский хинкал — символ единства горцев',
        text: 'Не путать с грузинскими хинкали! Это вареные в мясном бульоне кусочки теста, которые подаются отдельно от мяса с чесночным соусом и пиалой бульона. У каждого из 30 народов Дагестана — своя форма лепки.'
    },
    'Чуду': {
        badge: '🥟 Кулинарная традиция',
        title: 'Даргинское чуду — закрытый пирог с душой гор',
        text: 'Тонкие лепешки с мясом, картофелем, творогом или горной зеленью (крапивой и лебедой). Чуду жарят на сухой раскаленной сковороде и щедро смазывают топленым маслом.'
    },
    'Урбеч': {
        badge: '🍯 Древний суперфуд',
        title: 'Урбеч — энергия горцев на каменных жерновах',
        text: 'Густая паста из перетертых семян льна, тыквы или абрикосовых косточек. Горцы брали урбеч в походы через перевалы: две ложки с медом мгновенно восстанавливают силы.'
    },
    'Гамсутль': {
        badge: '🏰 Легенды аулов',
        title: 'Гамсутль — аул, высеченный прямо в скале',
        text: 'В переводе с аварского означает «у подножия ханской башни». Аул был неприступной крепостью на высоте 1418 метров, куда вела лишь узкая горная тропа.'
    },
    'Каньон': {
        badge: '⛰️ Чудо природы',
        title: 'Сулакский каньон — глубже Гранд-Каньона в США',
        text: 'Его глубина достигает 1920 метров, а протяженность — 53 километра. Бирюзовый цвет воде придают минеральные частицы горных пород.'
    }
};

function showFact(key) {
    const item = historyFacts[key];
    if (!item) return;
    document.getElementById('factBadge').innerText = item.badge;
    document.getElementById('factTitle').innerText = item.title;
    document.getElementById('factText').innerText = item.text;
}

function selectRecent(key, lat, lng) {
    showFact(key);
    flyToCoords(lat, lng, key);
}

// 3. ПОИСК ПО САЙТУ
function executeSearch() {
    const val = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!val) return;

    if (val.includes('чуду')) {
        showFact('Чуду');
        flyToCoords(42.9831, 47.5047, 'Где попробовать Даргинское чуду');
    } else if (val.includes('урбеч')) {
        showFact('Урбеч');
        flyToCoords(42.5539, 46.7167, 'Водяные мельницы Хунзаха');
    } else if (val.includes('хинкал') || val.includes('еда') || val.includes('поесть')) {
        showFact('Хинкал');
        flyToCoords(42.9831, 47.5047, 'Этно-кафе Махачкалы');
    } else if (val.includes('гамсутль') || val.includes('гуниб')) {
        showFact('Гамсутль');
        flyToCoords(42.3031, 46.9961, 'Аул-призрак Гамсутль');
    } else if (val.includes('каньон') || val.includes('сулак')) {
        showFact('Каньон');
        flyToCoords(43.0186, 46.8275, 'Сулакский каньон');
    } else if (val.includes('кубачи')) {
        flyToCoords(42.0942, 47.5964, 'Аул златокузнецов Кубачи');
    } else {
        document.getElementById('mapStatus').innerHTML = `🔍 По запросу «${val}» найдены маршруты в горном Дагестане`;
    }
}

// 4. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК МЕНЮ (еда / культура / отели / афиша)
const categoryData = {
    food: {
        heading: 'Гастрономические маршруты и кухня',
        cards: [
            { color: 'card-berry', pill: 'Хит • Кухня', rate: '★ 4.9', title: 'Вкус Страны гор: Хинкал и Чуду', desc: 'Дегустация блюд 5 народов Дагестана с историей каждого рецепта в гостях у горцев.', price: '4 500 ₽', coords: [42.9831, 47.5047] },
            { color: 'card-sky', pill: 'Дегустация', rate: '★ 5.0', title: 'Секреты Урбеча и горного меда', desc: 'Посещение действующей водяной мельницы в горах, где перетирают лен и абрикосовую косточку.', price: '2 800 ₽', coords: [42.5539, 46.7167] },
            { color: 'card-ochre', pill: 'Мастер-класс', rate: '★ 4.9', title: 'Лепка Курзе с косичкой', desc: 'Кулинарный вечер в старинном доме Гуниба с горным чаем из самовара на шишках.', price: '3 200 ₽', coords: [42.3867, 46.9614] },
            { color: 'card-berry', pill: 'Южный Дагестан', rate: '★ 4.8', title: 'Лезгинский цкан и шах-плов', desc: 'Гастрономическое путешествие в древний Дербент с ужином в этно-доме.', price: '4 100 ₽', coords: [42.0578, 48.2889] }
        ]
    },
    culture: {
        heading: 'Экскурсии по Дагестану и ремесла',
        cards: [
            { color: 'card-berry', pill: 'Ремесла • Этно', rate: '★ 4.9', title: 'Кубачи и Табасаранские ковры', desc: 'Секреты тысячелетней гравировки по серебру и ткачество орнамента «Древо жизни».', price: '4 800 ₽', coords: [42.0942, 47.5964] },
            { color: 'card-sky', pill: 'Природа • Хит', rate: '★ 5.0', title: 'Сулакский каньон и Чиркей', desc: 'Бирюзовая вода, смотровые площадки над пропастью и прогулка на катере.', price: '3 900 ₽', coords: [43.0186, 46.8275] },
            { color: 'card-ochre', pill: 'История • Горы', rate: '★ 4.9', title: 'Гамсутль и Гунибские башни', desc: 'Тропа к древнему аулу в облаках, легенды Кавказской войны и панорамы плато.', price: '4 200 ₽', coords: [42.3031, 46.9961] },
            { color: 'card-berry', pill: 'Древний город', rate: '★ 5.0', title: 'Дербент и крепость Нарын-Кала', desc: 'Прогулка по узким улочкам старых магалов и древнейшей мечети России.', price: '3 500 ₽', coords: [42.0578, 48.2889] }
        ]
    },
    hotels: {
        heading: 'Этно-отели и гостевые сакли в горах',
        cards: [
            { color: 'card-ochre', pill: 'Аул Чох • Вид на горы', rate: '★ 5.0', title: 'Этнодом в старинном ауле Чох', desc: 'Восстановленный горский дом XIX века с резными балконами и видом на террасы.', price: '6 500 ₽ / ночь', coords: [42.3208, 47.0319] },
            { color: 'card-sky', pill: 'Гуниб • Панорама', rate: '★ 4.9', title: 'Горный приют «Орлиное гнездо»', desc: 'Уютные номера на высоте 1500 метров с домашними завтраками из фермерских продуктов.', price: '5 800 ₽ / ночь', coords: [42.3867, 46.9614] },
            { color: 'card-berry', pill: 'Дербент • Старый город', rate: '★ 4.8', title: 'Бутик-отель в магалах Дербента', desc: 'Аутентичный интерьер с табасаранскими коврами в 5 минутах от крепости Нарын-Кала.', price: '7 200 ₽ / ночь', coords: [42.0578, 48.2889] },
            { color: 'card-ochre', pill: 'Хунзах • У водопада', rate: '★ 4.9', title: 'Глэмпинг на краю плато Тобот', desc: 'Панорамные домики прямо у обрыва каньона с видом на падающий водопад.', price: '8 000 ₽ / ночь', coords: [42.5539, 46.7167] }
        ]
    },
    events: {
        heading: 'Афиша фестивалей и мастер-классов',
        cards: [
            { color: 'card-berry', pill: 'Каждые выходные', rate: '★ 5.0', title: 'Фестиваль горского фольклора', desc: 'Традиционная лезгинка, игра на зурне и барабанах, старинные горские песни.', price: 'Вход свободный', coords: [42.9831, 47.5047] },
            { color: 'card-ochre', pill: 'Мастер-класс', rate: '★ 4.9', title: 'Гончарный круг в ауле Балхар', desc: 'Лепка знаменитой балхарской керамики с белой росписью под руководством мастериц.', price: '1 500 ₽', coords: [42.1931, 47.2053] },
            { color: 'card-sky', pill: 'Ярмарка', rate: '★ 4.8', title: 'Выставка кубачинских мастеров', desc: 'Уникальные украшения с чернью, чеканные кувшины и истории древних родов.', price: '500 ₽', coords: [42.0942, 47.5964] },
            { color: 'card-berry', pill: 'Этно-вечер', rate: '★ 5.0', title: 'Вечер дагестанских легенд у костра', desc: 'Сказания о героях гор, дегустация горного чая и сладостей в Гунибе.', price: '1 200 ₽', coords: [42.3867, 46.9614] }
        ]
    }
};

function switchCategory(cat, btn) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
btn.classList.add('active');
const data = categoryData[cat];
document.getElementById('gridHeading').innerText = data.heading;
const grid = document.getElementById('cardsGrid');
grid.innerHTML = data.cards.map(c => <article class="grid-card ${c.color}" onclick="openModal('${c.title}', '${c.desc}', '${c.price}', [${c.coords[0]}, ${c.coords[1]}])"> <div class="card-top"> <span class="card-pill">${c.pill}</span> <span class="card-rating">${c.rate}</span> </div> <h3>${c.title}</h3> <p>${c.desc}</p> <div class="card-footer"> <span class="price">${c.price}</span> <span class="action-link">Подробнее →</span> </div> </article>).join('');
}
// 5. ПЕРЕКЛЮЧЕНИЕ ТЕМЫ (ДЕНЬ / НОЧЬ) И ЯЗЫКА (АБ)
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
// 6. МОДАЛЬНОЕ ОКНО (ИСПРАВЛЕНА ПЕРЕДАЧА КООРДИНАТ)
function openModal(title, desc, price, coords) {
document.getElementById('modalTitle').innerText = title;
document.getElementById('modalDesc').innerText = desc;
document.getElementById('modalPrice').innerText = price;
document.getElementById('modalMapBtn').onclick = () => {
closeModal(null, true);
flyToCoords(coords[0], coords[1], title);
};
document.getElementById('modalOverlay').classList.add('open');
}
function closeModal(e, force) {
if (force || (e && e.target.id === 'modalOverlay')) {
document.getElementById('modalOverlay').classList.remove('open');
}
}
