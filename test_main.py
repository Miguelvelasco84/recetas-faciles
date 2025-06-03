import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.main import app, get_db, Base
import json

# Configurar base de datos de prueba
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def sample_user_data():
    return {
        "email": "test@ucatolica.edu.co",
        "name": "Usuario de Prueba"
    }

class TestAPI:
    def test_read_root(self, client):
        response = client.get("/")
        assert response.status_code == 200
        assert "RecetasFáciles" in response.json()["message"]

    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

class TestUsers:
    def test_create_user_student(self, client, sample_user_data):
        response = client.post("/users/", json=sample_user_data)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == sample_user_data["email"]
        assert data["is_student"] == True

    def test_create_user_non_student(self, client):
        user_data = {
            "email": "test@gmail.com",
            "name": "Usuario Gmail"
        }
        response = client.post("/users/", json=user_data)
        assert response.status_code == 200
        data = response.json()
        assert data["is_student"] == False

class TestRecipes:
    def test_get_recipes(self, client):
        response = client.get("/recipes/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_categories(self, client):
        response = client.get("/categories/")
        assert response.status_code == 200
        assert len(response.json()) >= 1

if __name__ == "__main__":
    pytest.main(["-v", "--tb=short"])

    