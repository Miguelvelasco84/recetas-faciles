import os
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
import random

# Configuración de base de datos para Render
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./recetas_faciles.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Configuración de FastAPI
app = FastAPI(
    title="RecetasFáciles API",
    version="1.0.0",
    description="API para la plataforma de recetas RecetasFáciles",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS para GitHub Pages
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tu-usuario.github.io",  # ⚠️ CAMBIAR por tu usuario de GitHub
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= MODELOS DE BASE DE DATOS =================

# Tablas de asociación
recipe_ingredients = Table(
    'recipe_ingredients',
    Base.metadata,
    Column('recipe_id', Integer, ForeignKey('recipes.id')),
    Column('ingredient_id', Integer, ForeignKey('ingredients.id')),
    Column('quantity', String),
    Column('is_optional', Boolean, default=False)
)

recipe_tags = Table(
    'recipe_tags',
    Base.metadata,
    Column('recipe_id', Integer, ForeignKey('recipes.id')),
    Column('tag_id', Integer, ForeignKey('tags.id'))
)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    is_student = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    recipes = relationship("Recipe", back_populates="author")
    favorites = relationship("Favorite", back_populates="user")
    ratings = relationship("Rating", back_populates="user")
    comments = relationship("Comment", back_populates="user")

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text)
    icon = Column(String)
    
    recipes = relationship("Recipe", back_populates="category")

class Recipe(Base):
    __tablename__ = "recipes"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    instructions = Column(Text)
    prep_time = Column(Integer)
    cook_time = Column(Integer)
    servings = Column(Integer)
    difficulty = Column(String)
    image_url = Column(String)
    video_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    category_id = Column(Integer, ForeignKey("categories.id"))
    author_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    category = relationship("Category", back_populates="recipes")
    author = relationship("User", back_populates="recipes")
    ingredients = relationship("Ingredient", secondary=recipe_ingredients, back_populates="recipes")
    tags = relationship("Tag", secondary=recipe_tags, back_populates="recipes")
    favorites = relationship("Favorite", back_populates="recipe")
    ratings = relationship("Rating", back_populates="recipe")
    comments = relationship("Comment", back_populates="recipe")
    
    @property
    def total_time(self):
        return (self.prep_time or 0) + (self.cook_time or 0)
    
    @property
    def average_rating(self):
        if self.ratings:
            return round(sum(rating.score for rating in self.ratings) / len(self.ratings), 1)
        return 0

class Ingredient(Base):
    __tablename__ = "ingredients"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    category = Column(String)
    
    recipes = relationship("Recipe", secondary=recipe_ingredients, back_populates="ingredients")

class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    color = Column(String, default="#007bff")
    
    recipes = relationship("Recipe", secondary=recipe_tags, back_populates="tags")

class Favorite(Base):
    __tablename__ = "favorites"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="favorites")
    recipe = relationship("Recipe", back_populates="favorites")

class Rating(Base):
    __tablename__ = "ratings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    score = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="ratings")
    recipe = relationship("Recipe", back_populates="ratings")

class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="comments")
    recipe = relationship("Recipe", back_populates="comments")

class ShoppingList(Base):
    __tablename__ = "shopping_lists"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")
    recipe = relationship("Recipe")

class UserRecommendation(Base):
    __tablename__ = "user_recommendations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    score = Column(Float)
    reason = Column(String)

# Crear tablas
Base.metadata.create_all(bind=engine)

# ================= SCHEMAS PYDANTIC =================

class UserCreate(BaseModel):
    email: EmailStr
    name: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    is_student: bool
    
    class Config:
        from_attributes = True

class IngredientBase(BaseModel):
    name: str
    quantity: str
    is_optional: bool = False

class RecipeCreate(BaseModel):
    title: str
    description: str
    instructions: str
    prep_time: int
    cook_time: int
    servings: int
    difficulty: str
    image_url: str
    video_url: Optional[str] = None
    category_id: int
    ingredients: List[IngredientBase]
    tags: List[str] = []

class RecipeResponse(BaseModel):
    id: int
    title: str
    description: str
    instructions: str
    prep_time: int
    cook_time: int
    servings: int
    difficulty: str
    image_url: str
    video_url: Optional[str]
    category_id: int
    author_id: int
    is_featured: bool
    total_time: int
    average_rating: float
    created_at: datetime
    
    class Config:
        from_attributes = True

class CategoryResponse(BaseModel):
    id: int
    name: str
    description: str
    icon: str
    
    class Config:
        from_attributes = True

class RatingCreate(BaseModel):
    recipe_id: int
    score: int

class CommentCreate(BaseModel):
    recipe_id: int
    content: str

# ================= DEPENDENCIAS =================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def is_student_email(email: str) -> bool:
    return False

# ================= FUNCIONES AUXILIARES =================

def generate_recommendations(db: Session, user_id: int) -> List[dict]:
    user_orders = db.query(Favorite).filter(Favorite.user_id == user_id).all()
    
    if not user_orders:
        popular_recipes = db.query(Recipe).filter(Recipe.is_featured == True).limit(3).all()
        return [
            {
                "product": recipe,
                "score": 0.8,
                "reason": "Receta popular"
            }
            for recipe in popular_recipes
        ]
    
    # Obtener categorías favoritas
    category_counts = {}
    for fav in user_orders:
        category_id = fav.recipe.category_id
        category_counts[category_id] = category_counts.get(category_id, 0) + 1
    
    recommendations = []
    for category_id, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
        category_recipes = db.query(Recipe).filter(
            Recipe.category_id == category_id,
            Recipe.is_active == True
        ).limit(2).all()
        
        for recipe in category_recipes:
            recommendations.append({
                "product": recipe,
                "score": min(0.9, 0.6 + (count * 0.1)),
                "reason": f"Basado en tus recetas favoritas de {recipe.category.name}"
            })
    
    return recommendations[:5]

def init_sample_data(db: Session):
    if db.query(Category).first():
        return
    
    categories = [
        {"name": "Desayunos", "description": "Recetas perfectas para empezar el día", "icon": "🍳"},
        {"name": "Almuerzos", "description": "Comidas completas y nutritivas", "icon": "🍽️"},
        {"name": "Cenas", "description": "Recetas para terminar el día", "icon": "🌙"},
        {"name": "Postres", "description": "Dulces tentaciones", "icon": "🍰"},
        {"name": "Bebidas", "description": "Refrescos y bebidas especiales", "icon": "🥤"},
        {"name": "Snacks", "description": "Bocadillos y aperitivos", "icon": "🍿"}
    ]
    
    for cat_data in categories:
        category = Category(**cat_data)
        db.add(category)
    
    db.commit()
    
    # Tags comunes
    common_tags = [
        {"name": "Fácil", "color": "#28a745"},
        {"name": "Rápido", "color": "#ffc107"},
        {"name": "Vegano", "color": "#17a2b8"},
        {"name": "Sin Gluten", "color": "#dc3545"},
        {"name": "Saludable", "color": "#20c997"},
        {"name": "Económico", "color": "#6f42c1"}
    ]
    
    for tag_data in common_tags:
        tag = Tag(**tag_data)
        db.add(tag)
    
    db.commit()
    
    # Recetas de ejemplo
    sample_recipes = [
        {
            "title": "Arepa con Queso",
            "description": "Arepa tradicional colombiana con queso mozzarella fundido",
            "instructions": "1. Mezclar harina de maíz con agua tibia y sal\n2. Amasar hasta obtener masa suave\n3. Formar bolitas y aplanar\n4. Cocinar en budare por 7 minutos cada lado\n5. Abrir y rellenar con queso",
            "prep_time": 10,
            "cook_time": 15,
            "servings": 2,
            "difficulty": "Fácil",
            "image_url": "https://images.unsplash.com/photo-1564489563601-c53cfc451e93",
            "category_id": 1,
            "is_featured": True
        },
        {
            "title": "Pasta Carbonara",
            "description": "Auténtica receta italiana de carbonara con huevos y panceta",
            "instructions": "1. Hervir pasta al dente\n2. Dorar panceta en sartén\n3. Batir huevos con queso\n4. Mezclar pasta caliente con huevos\n5. Agregar panceta y servir",
            "prep_time": 10,
            "cook_time": 20,
            "servings": 4,
            "difficulty": "Intermedio",
            "image_url": "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5",
            "category_id": 2,
            "is_featured": True
        },
        {
            "title": "Brownies de Chocolate",
            "description": "Brownies húmedos y deliciosos con chocolate negro",
            "instructions": "1. Derretir chocolate con mantequilla\n2. Batir huevos con azúcar\n3. Mezclar ingredientes secos\n4. Combinar todo\n5. Hornear 25 minutos a 180°C",
            "prep_time": 15,
            "cook_time": 25,
            "servings": 8,
            "difficulty": "Intermedio",
            "image_url": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c",
            "category_id": 4,
            "is_featured": True
        }
    ]
    
    for recipe_data in sample_recipes:
        recipe = Recipe(**recipe_data, author_id=1)
        db.add(recipe)
    
    db.commit()

# ================= ENDPOINTS =================

@app.on_event("startup")
async def startup_event():
    db = SessionLocal()
    try:
        init_sample_data(db)
    finally:
        db.close()

@app.get("/")
async def root():
    return {
        "message": "¡Bienvenido a RecetasFáciles API! 🍳👨‍🍳",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "online"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "database": "connected"
    }

# Usuarios
@app.post("/users/", response_model=UserResponse)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        return db_user
    
    is_student = is_student_email(user.email)
    db_user = User(
        email=user.email,
        name=user.name,
        is_student=is_student
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user

# Categorías
@app.get("/categories/", response_model=List[CategoryResponse])
async def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()

# Recetas
@app.get("/recipes/", response_model=List[RecipeResponse])
async def get_recipes(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    max_time: Optional[int] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Recipe).filter(Recipe.is_active == True)
    
    if category:
        query = query.join(Category).filter(Category.name.ilike(f"%{category}%"))
    if difficulty:
        query = query.filter(Recipe.difficulty == difficulty)
    if max_time:
        query = query.filter((Recipe.prep_time + Recipe.cook_time) <= max_time)
    if search:
        query = query.filter(Recipe.title.ilike(f"%{search}%"))
    if featured is not None:
        query = query.filter(Recipe.is_featured == featured)
    
    return query.offset(skip).limit(limit).all()

@app.get("/recipes/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return recipe

@app.post("/recipes/", response_model=RecipeResponse)
async def create_recipe(recipe: RecipeCreate, user_email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    db_recipe = Recipe(
        title=recipe.title,
        description=recipe.description,
        instructions=recipe.instructions,
        prep_time=recipe.prep_time,
        cook_time=recipe.cook_time,
        servings=recipe.servings,
        difficulty=recipe.difficulty,
        image_url=recipe.image_url,
        video_url=recipe.video_url,
        category_id=recipe.category_id,
        author_id=user.id
    )
    
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    
    # Agregar ingredientes
    for ingredient_data in recipe.ingredients:
        ingredient = db.query(Ingredient).filter(Ingredient.name == ingredient_data.name).first()
        if not ingredient:
            ingredient = Ingredient(name=ingredient_data.name)
            db.add(ingredient)
            db.commit()
            db.refresh(ingredient)
        
        db.execute(
            recipe_ingredients.insert().values(
                recipe_id=db_recipe.id,
                ingredient_id=ingredient.id,
                quantity=ingredient_data.quantity,
                is_optional=ingredient_data.is_optional
            )
        )
    
    # Agregar tags
    for tag_name in recipe.tags:
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if not tag:
            tag = Tag(name=tag_name, color=f"#{random.randint(0, 0xFFFFFF):06x}")
            db.add(tag)
            db.commit()
            db.refresh(tag)
        
        db.execute(
            recipe_tags.insert().values(
                recipe_id=db_recipe.id,
                tag_id=tag.id
            )
        )
    
    db.commit()
    return db_recipe

# Favoritos
@app.post("/favorites/")
async def add_to_favorites(recipe_id: int = Query(...), user_email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    existing = db.query(Favorite).filter(
        Favorite.user_id == user.id,
        Favorite.recipe_id == recipe_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="La receta ya está en favoritos")
    
    favorite = Favorite(user_id=user.id, recipe_id=recipe_id)
    db.add(favorite)
    db.commit()
    
    return {"message": "Receta agregada a favoritos"}

@app.delete("/favorites/{recipe_id}")
async def remove_from_favorites(recipe_id: int, user_email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    favorite = db.query(Favorite).filter(
        Favorite.user_id == user.id,
        Favorite.recipe_id == recipe_id
    ).first()
    
    if not favorite:
        raise HTTPException(status_code=404, detail="Receta no encontrada en favoritos")
    
    db.delete(favorite)
    db.commit()
    
    return {"message": "Receta removida de favoritos"}

@app.get("/favorites/", response_model=List[RecipeResponse])
async def get_user_favorites(user_email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    favorites = db.query(Recipe).join(Favorite).filter(
        Favorite.user_id == user.id,
        Recipe.is_active == True
    ).all()
    
    return favorites

# Calificaciones
@app.post("/ratings/")
async def rate_recipe(rating: RatingCreate, user_email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    existing_rating = db.query(Rating).filter(
        Rating.user_id == user.id,
        Rating.recipe_id == rating.recipe_id
    ).first()
    
    if existing_rating:
        existing_rating.score = rating.score
        db.commit()
        return {"message": "Calificación actualizada"}
    else:
        new_rating = Rating(
            user_id=user.id,
            recipe_id=rating.recipe_id,
            score=rating.score
        )
        db.add(new_rating)
        db.commit()
        return {"message": "Receta calificada exitosamente"}

@app.get("/recipes/{recipe_id}/rating")
async def get_recipe_rating(recipe_id: int, db: Session = Depends(get_db)):
    ratings = db.query(Rating).filter(Rating.recipe_id == recipe_id).all()
    
    if not ratings:
        return {"average": 0, "count": 0}
    
    average = sum(r.score for r in ratings) / len(ratings)
    return {"average": round(average, 1), "count": len(ratings)}

# Comentarios
@app.post("/comments/")
async def add_comment(comment: CommentCreate, user_email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    db_comment = Comment(
        user_id=user.id,
        recipe_id=comment.recipe_id,
        content=comment.content
    )
    
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    
    return {"message": "Comentario agregado exitosamente", "comment_id": db_comment.id}

@app.get("/recipes/{recipe_id}/comments")
async def get_recipe_comments(recipe_id: int, db: Session = Depends(get_db)):
    comments = db.query(Comment).filter(Comment.recipe_id == recipe_id).all()
    
    return [
        {
            "id": comment.id,
            "content": comment.content,
            "user_name": comment.user.name,
            "created_at": comment.created_at
        }
        for comment in comments
    ]

# Lista de compras
@app.post("/shopping-list/")
async def add_to_shopping_list(recipe_id: int = Query(...), user_email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    
    existing = db.query(ShoppingList).filter(
        ShoppingList.user_id == user.id,
        ShoppingList.recipe_id == recipe_id
    ).first()
    
    if not existing:
        shopping_item = ShoppingList(user_id=user.id, recipe_id=recipe_id)
        db.add(shopping_item)
        db.commit()
    
    return {"message": "Ingredientes agregados a la lista de compras"}

@app.get("/shopping-list/")
async def get_shopping_list(user_email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    shopping_items = db.query(ShoppingList).filter(ShoppingList.user_id == user.id).all()
    
    ingredients_list = []
    for item in shopping_items:
        recipe = item.recipe
        for ingredient in recipe.ingredients:
            recipe_ingredient = db.execute(
                recipe_ingredients.select().where(
                    recipe_ingredients.c.recipe_id == recipe.id,
                    recipe_ingredients.c.ingredient_id == ingredient.id
                )
            ).first()
            
            ingredients_list.append({
                "ingredient": ingredient.name,
                "quantity": recipe_ingredient.quantity if recipe_ingredient else "",
                "recipe_name": recipe.title,
                "is_optional": recipe_ingredient.is_optional if recipe_ingredient else False
            })
    
    return ingredients_list

# Recomendaciones
@app.get("/recommendations/{user_email}")
async def get_user_recommendations(user_email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    
    if not user:
        popular_recipes = db.query(Recipe).filter(Recipe.is_featured == True).limit(3).all()
        return [
            {
                "recipe": recipe,
                "reason": "Receta popular"
            }
            for recipe in popular_recipes
        ]
    
    recommendations = generate_recommendations(db, user.id)
    
    return [
        {
            "recipe": rec["product"],
            "reason": rec["reason"]
        }
        for rec in recommendations
    ]

# Ingredientes
@app.get("/ingredients/")
async def get_ingredients(search: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Ingredient)
    
    if search:
        query = query.filter(Ingredient.name.ilike(f"%{search}%"))
    
    return query.limit(20).all()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

    
# Editar receta
@app.put("/recipes/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(recipe_id: int, updated_recipe: RecipeCreate, user_email: str = Query(...), db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    
    user = db.query(User).filter(User.email == user_email).first()
    if not user or recipe.author_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado para editar esta receta")
    
    for attr, value in updated_recipe.dict().items():
        if hasattr(recipe, attr):
            setattr(recipe, attr, value)
    
    db.commit()
    db.refresh(recipe)
    return recipe

# Eliminar receta (mantener historial)
@app.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: int, user_email: str = Query(...), db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    
    user = db.query(User).filter(User.email == user_email).first()
    if not user or recipe.author_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado para eliminar esta receta")
    
    recipe.is_active = False
    db.commit()
    return {"message": "Receta eliminada (marcada como inactiva)"}
