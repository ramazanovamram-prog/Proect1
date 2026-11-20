from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import os

app = FastAPI()

# Настройка CORS, чтобы фронтенд мог делать запросы к бэкенду
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Путь к базе данных (находится на уровень выше папки backend)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'tourism.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Модель для запроса генерации маршрута (если понадобится)
class RouteRequest(BaseModel):
    days: int
    budget: int
    with_kids: bool

# ==========================================
# 1. ЭНДПОИНТЫ ДЛЯ КАРТЫ И ОСНОВНОГО КАТАЛОГА
# ==========================================

@app.get("/api/places")
def get_places():
    """Отдает ВСЕ места (для отображения на карте)"""
    conn = get_db_connection()
    places = conn.execute('SELECT * FROM places').fetchall()
    conn.close()
    return [dict(place) for place in places]


# ==========================================
# 2. ЭНДПОИНТЫ ДЛЯ ПОИСКА И ИСТОРИИ
# ==========================================

@app.get("/api/search")
def search_places(category: str = None, query: str = None):
    """
    Умный поиск. Принимает категорию и текстовый запрос.
    Ищет совпадения в названии, описании и маршруте.
    """
    conn = get_db_connection()
    
    sql = "SELECT * FROM places WHERE 1=1"
    params = []
    
    # Фильтр по категории (еда, культура и т.д.)
    if category and category.strip() != "" and category != "все":
        sql += " AND category = ?"
        params.append(category.strip())
        
    # Поиск по тексту
    if query and query.strip() != "":
        sql += " AND (name LIKE ? OR description LIKE ? OR route_points LIKE ?)"
        params.append(f"%{query.strip()}%")
        params.append(f"%{query.strip()}%")
        params.append(f"%{query.strip()}%")
        
        # Сохраняем запрос в историю
        conn.execute('INSERT INTO last_queries (query_text, category) VALUES (?, ?)', 
                     (query.strip(), category if category else "все"))
        conn.commit()
        
    results = conn.execute(sql, params).fetchall()
    conn.close()
    
    return [dict(row) for row in results]


@app.get("/api/last-queries")
def get_last_queries():
    """Отдает последние 5 поисковых запросов для блока 'Последние запросы'"""
    conn = get_db_connection()
    queries = conn.execute('SELECT * FROM last_queries ORDER BY id DESC LIMIT 5').fetchall()
    conn.close()
    return [dict(q) for q in queries]


@app.get("/api/categories")
def get_categories():
    """Отдает список доступных категорий для кнопок меню"""
    return ["все", "еда", "культура", "природа", "отели", "афиша"]


# ==========================================
# 3. ЭНДПОИНТЫ ДЛЯ КАТАЛОГА ЭКСКУРСИЙ (НИЖНИЙ БЛОК)
# ==========================================

@app.get("/api/excursions")
def get_excursions(days: int = None):
    """
    Каталог экскурсий.
    Принимает необязательный параметр days (количество дней) для фильтрации.
    """
    conn = get_db_connection()
    
    if days is not None:
        # Если передан параметр days (1, 2, 3...), фильтруем по нему
        excursions = conn.execute('SELECT * FROM places WHERE is_excursion = 1 AND days = ?', (days,)).fetchall()
    else:
        # Если параметр не передан, отдаем все экскурсии
        excursions = conn.execute('SELECT * FROM places WHERE is_excursion = 1').fetchall()
        
    conn.close()
    return [dict(exc) for exc in excursions]


# ==========================================
# 4. (ОПЦИОНАЛЬНО) ГЕНЕРАТОР МАРШРУТОВ
# ==========================================

@app.post("/api/generate-route")
def generate_route(req: RouteRequest):
    """Старая логика генерации маршрута, если она еще нужна"""
    conn = get_db_connection()
    query = 'SELECT * FROM places WHERE price <= ? ORDER BY price ASC'
    places = conn.execute(query, (req.budget,)).fetchall()
    conn.close()

    selected = []
    current_budget = 0
    current_time = 0
    max_time = req.days * 8

    for place in places:
        if current_budget + place["price"] <= req.budget and current_time + place["time_hours"] <= max_time:
            selected.append(dict(place))
            current_budget += place["price"]
            current_time += place["time_hours"]

    return {
        "status": "success",
        "total_spent": current_budget,
        "total_time": current_time,
        "route": selected
    }