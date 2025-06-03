// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDk0RoiW5wyaNzsfKFlcyHH5vtpDYp7LeY",
  authDomain: "blessedfood-8aeba.firebaseapp.com",
  projectId: "blessedfood-8aeba",
  storageBucket: "blessedfood-8aeba.firebasestorage.app",
  messagingSenderId: "843865224329",
  appId: "1:843865224329:web:d46d3d7335bf2dfba40258"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Configuración de la API
const API_BASE_URL = 'https://recetas-backend.onrender.com';
let usuarioLogueado = false;
let usuarioActual = null;
let recetas = [];
let categorias = [];
let favoritos = [];
let listaCompras = [];
let currentPage = 0;
const RECIPES_PER_PAGE = 12;

// ================= FUNCIONES DE UTILIDAD =================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remover después de 4 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => container.removeChild(toast), 300);
    }, 4000);
}

function showLoading(show = true) {
    const spinner = document.getElementById('loading-spinner');
    if (show) {
        spinner.classList.remove('none');
    } else {
        spinner.classList.add('none');
    }
}

function formatTime(minutes) {
    if (minutes < 60) {
        return `${minutes} min`;
    } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
}

function getDifficultyColor(difficulty) {
    switch(difficulty) {
        case 'Fácil': return '#28a745';
        case 'Intermedio': return '#ffc107';
        case 'Difícil': return '#dc3545';
        default: return '#6c757d';
    }
}

// ================= FUNCIONES DE API =================

async function fetchAPI(endpoint, options = {}) {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error en API:', error);
        showToast('Error de conexión. Por favor, inténtalo de nuevo.', 'error');
        throw error;
    } finally {
        showLoading(false);
    }
}

async function obtenerRecetas(filters = {}) {
    try {
        const params = new URLSearchParams();
        
        if (filters.skip) params.append('skip', filters.skip);
        if (filters.limit) params.append('limit', filters.limit);
        if (filters.category) params.append('category', filters.category);
        if (filters.difficulty) params.append('difficulty', filters.difficulty);
        if (filters.max_time) params.append('max_time', filters.max_time);
        if (filters.search) params.append('search', filters.search);
        if (filters.featured !== undefined) params.append('featured', filters.featured);
        
        const endpoint = `/recipes/?${params.toString()}`;
        return await fetchAPI(endpoint);
    } catch (error) {
        console.error('Error obteniendo recetas:', error);
        return [];
    }
}

async function obtenerRecetaDetalle(recipeId) {
    try {
        return await fetchAPI(`/recipes/${recipeId}`);
    } catch (error) {
        console.error('Error obteniendo detalle de receta:', error);
        return null;
    }
}

async function obtenerCategorias() {
    try {
        return await fetchAPI('/categories/');
    } catch (error) {
        console.error('Error obteniendo categorías:', error);
        return [];
    }
}

async function obtenerRecomendaciones(userEmail) {
    try {
        return await fetchAPI(`/recommendations/${userEmail}`);
    } catch (error) {
        console.error('Error obteniendo recomendaciones:', error);
        return [];
    }
}

async function crearReceta(recetaData, userEmail) {
    try {
        return await fetchAPI(`/recipes/?user_email=${userEmail}`, {
            method: 'POST',
            body: JSON.stringify(recetaData)
        });
    } catch (error) {
        console.error('Error creando receta:', error);
        throw error;
    }
}

async function toggleFavorito(recipeId, userEmail, isAdd = true) {
    try {
        const endpoint = `/favorites/${isAdd ? '' : recipeId}`;
        const method = isAdd ? 'POST' : 'DELETE';
        
        if (isAdd) {
            return await fetchAPI(`${endpoint}?recipe_id=${recipeId}&user_email=${userEmail}`, {
                method: 'POST'
            });
        } else {
            return await fetchAPI(`${endpoint}?user_email=${userEmail}`, {
                method: 'DELETE'
            });
        }
    } catch (error) {
        console.error('Error manejando favorito:', error);
        throw error;
    }
}

async function obtenerFavoritos(userEmail) {
    try {
        return await fetchAPI(`/favorites/?user_email=${userEmail}`);
    } catch (error) {
        console.error('Error obteniendo favoritos:', error);
        return [];
    }
}

async function calificarReceta(recipeId, score, userEmail) {
    try {
        return await fetchAPI(`/ratings/?user_email=${userEmail}`, {
            method: 'POST',
            body: JSON.stringify({
                recipe_id: recipeId,
                score: score
            })
        });
    } catch (error) {
        console.error('Error calificando receta:', error);
        throw error;
    }
}

async function agregarComentario(recipeId, content, userEmail) {
    try {
        return await fetchAPI(`/comments/?user_email=${userEmail}`, {
            method: 'POST',
            body: JSON.stringify({
                recipe_id: recipeId,
                content: content
            })
        });
    } catch (error) {
        console.error('Error agregando comentario:', error);
        throw error;
    }
}

async function obtenerComentarios(recipeId) {
    try {
        return await fetchAPI(`/recipes/${recipeId}/comments`);
    } catch (error) {
        console.error('Error obteniendo comentarios:', error);
        return [];
    }
}

async function obtenerCalificacion(recipeId) {
    try {
        return await fetchAPI(`/recipes/${recipeId}/rating`);
    } catch (error) {
        console.error('Error obteniendo calificación:', error);
        return { average: 0, count: 0 };
    }
}

async function agregarAListaCompras(recipeId, userEmail) {
    try {
        return await fetchAPI(`/shopping-list/?recipe_id=${recipeId}&user_email=${userEmail}`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('Error agregando a lista de compras:', error);
        throw error;
    }
}

async function obtenerListaCompras(userEmail) {
    try {
        return await fetchAPI(`/shopping-list/?user_email=${userEmail}`);
    } catch (error) {
        console.error('Error obteniendo lista de compras:', error);
        return [];
    }
}

// ================= FUNCIONES DE AUTENTICACIÓN =================

function loginWithProvider(provider) {
    auth.signInWithPopup(provider)
        .then(async (result) => {
            const user = result.user;
            const email = user.email;
            const domain = email.split("@")[1];
            const allowedDomains = ["ucatolica.edu.co", "gmail.com"];

            if (allowedDomains.includes(domain)) {
                try {
                    usuarioActual = await crearOActualizarUsuario(email, user.displayName);
                    usuarioLogueado = true;
                    
                    document.getElementById("user-status").textContent = `¡Hola, ${user.displayName}!`;
                    document.getElementById("google-login").style.display = "none";
                    document.getElementById("microsoft-login").style.display = "none";
                    document.getElementById("logout").style.display = "inline";
                    
                    // Mostrar elementos para usuarios logueados
                    mostrarElementosUsuario(true);
                    
                    // Mostrar badge si es estudiante
                    if (usuarioActual.is_student) {
                        document.getElementById("student-status").classList.remove("none");
                    }
                    
                    // Cargar datos del usuario
                    await cargarDatosUsuario();
                    
                    showToast(`¡Bienvenido, ${user.displayName}!`, 'success');
                    
                } catch (error) {
                    showToast("Error al procesar tu información de usuario", 'error');
                }
            } else {
                auth.signOut();
                showToast("Correo no autorizado. Solo se permiten correos de @ucatolica.edu.co y @gmail.com", 'error');
            }
        })
        .catch((error) => {
            console.error(error);
            showToast("Error en el login: " + error.message, 'error');
        });
}

async function crearOActualizarUsuario(email, nombre) {
    try {
        const userData = {
            email: email,
            name: nombre
        };
        
        return await fetchAPI('/users/', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    } catch (error) {
        console.error('Error creando/actualizando usuario:', error);
        throw error;
    }
}

function mostrarElementosUsuario(mostrar) {
    const elementos = [
        'favorites-btn',
        'shopping-list-btn', 
        'add-recipe-btn',
        'recommendations-section'
    ];
    
    elementos.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            if (mostrar) {
                elemento.classList.remove('none');
            } else {
                elemento.classList.add('none');
            }
        }
    });
}

async function cargarDatosUsuario() {
    if (!usuarioActual) return;
    
    try {
        // Cargar favoritos
        favoritos = await obtenerFavoritos(usuarioActual.email);
        actualizarContadorFavoritos();
        
        // Cargar lista de compras
        listaCompras = await obtenerListaCompras(usuarioActual.email);
        actualizarContadorCompras();
        
        // Cargar recomendaciones
        await cargarRecomendaciones();
        
    } catch (error) {
        console.error('Error cargando datos del usuario:', error);
    }
}

// ================= FUNCIONES DE RENDERIZADO =================

function renderizarRecetas(recetasData, containerId = 'recipes-grid', append = false) {
    const container = document.getElementById(containerId);
    
    if (!append) {
        container.innerHTML = '';
    }
    
    if (recetasData.length === 0 && !append) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No se encontraron recetas</h3>
                <p>Prueba ajustando los filtros o busca algo diferente</p>
            </div>
        `;
        return;
    }
    
    recetasData.forEach(receta => {
        const card = crearTarjetaReceta(receta);
        container.appendChild(card);
    });
}

function crearTarjetaReceta(receta) {
    const div = document.createElement('div');
    div.className = 'recipe-card';
    div.setAttribute('data-recipe-id', receta.id);
    
    const esFavorito = favoritos.some(fav => fav.id === receta.id);
    const totalTime = (receta.prep_time || 0) + (receta.cook_time || 0);
    
    div.innerHTML = `
        <div class="recipe-image-container">
            <img src="${receta.image_url}" alt="${receta.title}" class="recipe-image" loading="lazy">
            <div class="recipe-overlay">
                <button class="recipe-action-btn favorite-btn ${esFavorito ? 'active' : ''}" 
                        onclick="toggleFavoritoReceta(${receta.id}, this)">
                    <i class="fas fa-heart"></i>
                </button>
                <button class="recipe-action-btn" onclick="agregarACompras(${receta.id})">
                    <i class="fas fa-shopping-list"></i>
                </button>
            </div>
            <div class="recipe-difficulty" style="background: ${getDifficultyColor(receta.difficulty)}">
                ${receta.difficulty}
            </div>
        </div>
        
        <div class="recipe-content">
            <h3 class="recipe-title">${receta.title}</h3>
            <p class="recipe-description">${receta.description}</p>
            
            <div class="recipe-meta">
                <div class="meta-item">
                    <i class="fas fa-clock"></i>
                    <span>${formatTime(totalTime)}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-users"></i>
                    <span>${receta.servings} ${receta.servings === 1 ? 'porción' : 'porciones'}</span>
                </div>
                <div class="meta-item rating">
                    <i class="fas fa-star"></i>
                    <span>${receta.average_rating || 0}</span>
                </div>
            </div>
            
            <button class="view-recipe-btn" onclick="abrirModalReceta(${receta.id})">
                <i class="fas fa-eye"></i> Ver Receta
            </button>
        </div>
    `;
    
    return div;
}

function renderizarCategorias(categoriasData) {
    const container = document.getElementById('categories-grid');
    container.innerHTML = '';
    
    categoriasData.forEach(categoria => {
        const div = document.createElement('div');
        div.className = 'category-card';
        div.innerHTML = `
            <div class="category-icon">${categoria.icon || '🍽️'}</div>
            <h3>${categoria.name}</h3>
            <p>${categoria.description}</p>
            <button class="category-btn" onclick="filtrarPorCategoria('${categoria.name}')">
                Explorar
            </button>
        `;
        container.appendChild(div);
    });
}

function renderizarRecomendaciones(recomendacionesData) {
    const container = document.getElementById('recommendations-grid');
    container.innerHTML = '';
    
    if (recomendacionesData.length === 0) {
        document.getElementById('recommendations-section').classList.add('none');
        return;
    }
    
    recomendacionesData.forEach(item => {
        const receta = item.recipe || item;
        const razon = item.reason || 'Recomendado para ti';
        
        const div = document.createElement('div');
        div.className = 'recommendation-card';
        div.innerHTML = `
            <img src="${receta.image_url}" alt="${receta.title}" class="recommendation-image">
            <div class="recommendation-content">
                <h4>${receta.title}</h4>
                <p class="recommendation-reason">${razon}</p>
                <div class="recommendation-meta">
                    <span><i class="fas fa-clock"></i> ${formatTime((receta.prep_time || 0) + (receta.cook_time || 0))}</span>
                    <span><i class="fas fa-signal"></i> ${receta.difficulty}</span>
                </div>
                <button class="recommendation-btn" onclick="abrirModalReceta(${receta.id})">
                    Ver Receta
                </button>
            </div>
        `;
        container.appendChild(div);
    });
    
    document.getElementById('recommendations-section').classList.remove('none');
}

function llenarSelectCategorias() {
    const selects = ['category-filter', 'recipe-category'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            // Limpiar opciones existentes excepto la primera
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            categorias.forEach(categoria => {
                const option = document.createElement('option');
                option.value = categoria.name;
                option.textContent = categoria.name;
                select.appendChild(option);
            });
        }
    });
}

// ================= MODAL DE RECETA =================

async function abrirModalReceta(recipeId) {
    const modal = document.getElementById('recipe-modal');
    
    try {
        // Obtener detalles de la receta
        const receta = await obtenerRecetaDetalle(recipeId);
        if (!receta) {
            showToast('No se pudo cargar la receta', 'error');
            return;
        }
        
        // Llenar el modal con los datos
        document.getElementById('modal-recipe-title').textContent = receta.title;
        document.getElementById('modal-recipe-image').src = receta.image_url;
        document.getElementById('modal-recipe-description').textContent = receta.description;
        document.getElementById('modal-prep-time').textContent = `Prep: ${formatTime(receta.prep_time)}`;
        document.getElementById('modal-cook-time').textContent = `Cocción: ${formatTime(receta.cook_time || 0)}`;
        document.getElementById('modal-servings').textContent = `${receta.servings} porciones`;
        document.getElementById('modal-difficulty').textContent = receta.difficulty;
        
        // Cargar calificación
        const rating = await obtenerCalificacion(recipeId);
        actualizarEstrellas('modal-rating-stars', rating.average);
        document.getElementById('modal-rating-text').textContent = 
            rating.count > 0 ? `${rating.average}/5 (${rating.count} calificaciones)` : 'Sin calificaciones';
        
        // Cargar ingredientes (esto sería más complejo en implementación real)
        const ingredientsContainer = document.getElementById('modal-ingredients');
        ingredientsContainer.innerHTML = `
            <div class="ingredient-item">
                <input type="checkbox" id="ing-1">
                <label for="ing-1">2 tazas de harina</label>
            </div>
            <div class="ingredient-item">
                <input type="checkbox" id="ing-2">
                <label for="ing-2">3 huevos</label>
            </div>
            <div class="ingredient-item">
                <input type="checkbox" id="ing-3">
                <label for="ing-3">1 taza de leche</label>
            </div>
        `;
        
        // Cargar instrucciones
        const instructionsContainer = document.getElementById('modal-instructions');
        const instrucciones = receta.instructions.split('\n').filter(step => step.trim());
        instructionsContainer.innerHTML = instrucciones.map((step, index) => `
            <div class="instruction-step">
                <div class="step-number">${index + 1}</div>
                <div class="step-content">${step.trim()}</div>
            </div>
        `).join('');
        
        // Cargar comentarios
        await cargarComentarios(recipeId);
        
        // Configurar botones
        const favBtn = document.getElementById('modal-favorite-btn');
        const esFavorito = favoritos.some(fav => fav.id === recipeId);
        favBtn.innerHTML = esFavorito ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
        favBtn.onclick = () => toggleFavoritoReceta(recipeId, favBtn);
        
        const shopBtn = document.getElementById('modal-shopping-btn');
        shopBtn.onclick = () => agregarACompras(recipeId);
        
        // Configurar calificación
        configurarCalificacion(recipeId);
        
        modal.classList.remove('none');
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error abriendo modal:', error);
        showToast('Error al cargar la receta', 'error');
    }
}

function cerrarModalReceta() {
    const modal = document.getElementById('recipe-modal');
    modal.classList.add('none');
    document.body.style.overflow = 'auto';
}

async function cargarComentarios(recipeId) {
    try {
        const comentarios = await obtenerComentarios(recipeId);
        const container = document.getElementById('comments-list');
        
        if (comentarios.length === 0) {
            container.innerHTML = '<p class="no-comments">Aún no hay comentarios. ¡Sé el primero en comentar!</p>';
            return;
        }
        
        container.innerHTML = comentarios.map(comentario => `
            <div class="comment-item">
                <div class="comment-header">
                    <strong>${comentario.user_name}</strong>
                    <span class="comment-date">${new Date(comentario.created_at).toLocaleDateString()}</span>
                </div>
                <p class="comment-content">${comentario.content}</p>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando comentarios:', error);
    }
}

function configurarCalificacion(recipeId) {
    const stars = document.querySelectorAll('#user-rating .fa-star');
    
    stars.forEach(star => {
        star.onclick = async () => {
            if (!usuarioLogueado) {
                showToast('Debes iniciar sesión para calificar recetas', 'error');
                return;
            }
            
            const rating = parseInt(star.dataset.rating);
            
            try {
                await calificarReceta(recipeId, rating, usuarioActual.email);
                
                // Actualizar estrellas visualmente
                stars.forEach((s, index) => {
                    s.className = index < rating ? 'fas fa-star' : 'far fa-star';
                });
                
                showToast('¡Gracias por tu calificación!', 'success');
                
                // Recargar calificación promedio
                const newRating = await obtenerCalificacion(recipeId);
                actualizarEstrellas('modal-rating-stars', newRating.average);
                document.getElementById('modal-rating-text').textContent = 
                    `${newRating.average}/5 (${newRating.count} calificaciones)`;
                
            } catch (error) {
                showToast('Error al guardar la calificación', 'error');
            }
        };
    });
}

function actualizarEstrellas(containerId, rating) {
    const container = document.getElementById(containerId);
    const stars = container.querySelectorAll('.fa-star');
    
    stars.forEach((star, index) => {
        star.className = index < Math.floor(rating) ? 'fas fa-star' : 'far fa-star';
    });
}

// ================= FUNCIONES DE FAVORITOS =================

async function toggleFavoritoReceta(recipeId, button) {
    if (!usuarioLogueado) {
        showToast('Debes iniciar sesión para guardar favoritos', 'error');
        return;
    }
    
    try {
        const esFavorito = favoritos.some(fav => fav.id === recipeId);
        
        if (esFavorito) {
            await toggleFavorito(recipeId, usuarioActual.email, false);
            favoritos = favoritos.filter(fav => fav.id !== recipeId);
            button.classList.remove('active');
            button.innerHTML = '<i class="far fa-heart"></i>';
            showToast('Receta removida de favoritos', 'info');
        } else {
            await toggleFavorito(recipeId, usuarioActual.email, true);
            // Obtener la receta completa para agregarla a favoritos
            const receta = await obtenerRecetaDetalle(recipeId);
            if (receta) {
                favoritos.push(receta);
            }
            button.classList.add('active');
            button.innerHTML = '<i class="fas fa-heart"></i>';
            showToast('Receta agregada a favoritos', 'success');
        }
        
        actualizarContadorFavoritos();
        
    } catch (error) {
        showToast('Error al actualizar favoritos', 'error');
    }
}

function actualizarContadorFavoritos() {
    const counter = document.getElementById('favorites-count');
    counter.textContent = favoritos.length;
    
    if (favoritos.length > 0) {
        counter.classList.remove('none');
    } else {
        counter.classList.add('none');
    }
}

function abrirSidebarFavoritos() {
    const sidebar = document.getElementById('favorites-sidebar');
    const lista = document.getElementById('favorites-list');
    const emptyState = document.getElementById('empty-favorites');
    
    if (favoritos.length === 0) {
        emptyState.classList.remove('none');
        lista.classList.add('none');
    } else {
        emptyState.classList.add('none');
        lista.classList.remove('none');
        
        lista.innerHTML = favoritos.map(receta => `
            <div class="favorite-item">
                <img src="${receta.image_url}" alt="${receta.title}">
                <div class="favorite-content">
                    <h4>${receta.title}</h4>
                    <p>${formatTime((receta.prep_time || 0) + (receta.cook_time || 0))} • ${receta.difficulty}</p>
                    <div class="favorite-actions">
                        <button onclick="abrirModalReceta(${receta.id})" class="view-btn">Ver</button>
                        <button onclick="toggleFavoritoReceta(${receta.id}, this)" class="remove-btn">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    sidebar.classList.remove('none');
}

// ================= FUNCIONES DE LISTA DE COMPRAS =================

async function agregarACompras(recipeId) {
    if (!usuarioLogueado) {
        showToast('Debes iniciar sesión para usar la lista de compras', 'error');
        return;
    }
    
    try {
        await agregarAListaCompras(recipeId, usuarioActual.email);
        
        // Actualizar lista local
        listaCompras = await obtenerListaCompras(usuarioActual.email);
        actualizarContadorCompras();
        
        showToast('Ingredientes agregados a la lista de compras', 'success');
        
    } catch (error) {
        showToast('Error al agregar a la lista de compras', 'error');
    }
}

function actualizarContadorCompras() {
    const counter = document.getElementById('shopping-count');
    counter.textContent = listaCompras.length;
    
    if (listaCompras.length > 0) {
        counter.classList.remove('none');
    } else {
        counter.classList.add('none');
    }
}

function abrirSidebarCompras() {
    const sidebar = document.getElementById('shopping-sidebar');
    const lista = document.getElementById('shopping-list');
    const emptyState = document.getElementById('empty-shopping');
    
    if (listaCompras.length === 0) {
        emptyState.classList.remove('none');
        lista.classList.add('none');
    } else {
        emptyState.classList.add('none');
        lista.classList.remove('none');
        
        // Agrupar ingredientes por nombre
        const ingredientesAgrupados = {};
        listaCompras.forEach(item => {
            if (!ingredientesAgrupados[item.ingredient]) {
                ingredientesAgrupados[item.ingredient] = {
                    ingredient: item.ingredient,
                    quantities: [],
                    recipes: []
                };
            }
            ingredientesAgrupados[item.ingredient].quantities.push(item.quantity);
            ingredientesAgrupados[item.ingredient].recipes.push(item.recipe_name);
        });
        
        lista.innerHTML = Object.values(ingredientesAgrupados).map(item => `
            <div class="shopping-item">
                <input type="checkbox" class="shopping-checkbox">
                <div class="shopping-content">
                    <h4>${item.ingredient}</h4>
                    <p class="quantities">${item.quantities.join(', ')}</p>
                    <small class="recipes">Para: ${[...new Set(item.recipes)].join(', ')}</small>
                </div>
            </div>
        `).join('');
    }
    
    sidebar.classList.remove('none');
}

// ================= MODAL AGREGAR RECETA =================

function abrirModalAgregarReceta() {
    if (!usuarioLogueado) {
        showToast('Debes iniciar sesión para compartir recetas', 'error');
        return;
    }
    
    const modal = document.getElementById('add-recipe-modal');
    modal.classList.remove('none');
    document.body.style.overflow = 'hidden';
}

function cerrarModalAgregarReceta() {
    const modal = document.getElementById('add-recipe-modal');
    modal.classList.add('none');
    document.body.style.overflow = 'auto';
    
    // Limpiar formulario
    document.getElementById('add-recipe-form').reset();
    
    // Resetear ingredientes a uno solo
    const container = document.getElementById('ingredients-container');
    container.innerHTML = `
        <div class="ingredient-row">
            <input type="text" placeholder="Nombre del ingrediente" class="ingredient-name" required>
            <input type="text" placeholder="Cantidad (ej: 2 tazas)" class="ingredient-quantity" required>
            <label class="checkbox-label">
                <input type="checkbox" class="ingredient-optional">
                <span>Opcional</span>
            </label>
            <button type="button" class="remove-ingredient-btn">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
}

function agregarIngrediente() {
    const container = document.getElementById('ingredients-container');
    const newRow = document.createElement('div');
    newRow.className = 'ingredient-row';
    newRow.innerHTML = `
        <input type="text" placeholder="Nombre del ingrediente" class="ingredient-name" required>
        <input type="text" placeholder="Cantidad (ej: 2 tazas)" class="ingredient-quantity" required>
        <label class="checkbox-label">
            <input type="checkbox" class="ingredient-optional">
            <span>Opcional</span>
        </label>
        <button type="button" class="remove-ingredient-btn" onclick="this.parentElement.remove()">
            <i class="fas fa-trash"></i>
        </button>
    `;
    container.appendChild(newRow);
}

async function procesarFormularioReceta(event) {
    event.preventDefault();
    
    try {
        // Recolectar datos del formulario
        const formData = {
            title: document.getElementById('recipe-title').value,
            description: document.getElementById('recipe-description').value,
            instructions: document.getElementById('recipe-instructions').value,
            prep_time: parseInt(document.getElementById('prep-time').value),
            cook_time: parseInt(document.getElementById('cook-time').value) || 0,
            servings: parseInt(document.getElementById('servings').value),
            difficulty: document.getElementById('difficulty').value,
            image_url: document.getElementById('recipe-image-url').value || 'https://via.placeholder.com/400x300',
            video_url: document.getElementById('recipe-video-url').value || null,
            category_id: parseInt(document.getElementById('recipe-category').value),
            ingredients: [],
            tags: []
        };
        
        // Recolectar ingredientes
        const ingredientRows = document.querySelectorAll('.ingredient-row');
        ingredientRows.forEach(row => {
            const name = row.querySelector('.ingredient-name').value.trim();
            const quantity = row.querySelector('.ingredient-quantity').value.trim();
            const isOptional = row.querySelector('.ingredient-optional').checked;
            
            if (name && quantity) {
                formData.ingredients.push({
                    name: name,
                    quantity: quantity,
                    is_optional: isOptional
                });
            }
        });
        
        // Recolectar tags
        const tagsValue = document.getElementById('recipe-tags').value.trim();
        if (tagsValue) {
            formData.tags = tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag);
        }
        
        // Validaciones
        if (formData.ingredients.length === 0) {
            showToast('Debes agregar al menos un ingrediente', 'error');
            return;
        }
        
        // Crear receta
        showLoading(true);
        const nuevaReceta = await crearReceta(formData, usuarioActual.email);
        
        showToast('¡Receta creada exitosamente!', 'success');
        cerrarModalAgregarReceta();
        
        // Recargar recetas
        await cargarRecetas();
        
    } catch (error) {
        console.error('Error creando receta:', error);
        showToast('Error al crear la receta. Inténtalo de nuevo.', 'error');
    } finally {
        showLoading(false);
    }
}

// ================= FUNCIONES DE BÚSQUEDA Y FILTROS =================

async function buscarRecetas() {
    const searchTerm = document.getElementById('recipe-search').value.trim();
    const difficulty = document.getElementById('difficulty-filter').value;
    const maxTime = document.getElementById('time-filter').value;
    const category = document.getElementById('category-filter').value;
    
    const filters = {
        limit: RECIPES_PER_PAGE,
        skip: 0
    };
    
    if (searchTerm) filters.search = searchTerm;
    if (difficulty) filters.difficulty = difficulty;
    if (maxTime) filters.max_time = parseInt(maxTime);
    if (category) filters.category = category;
    
    try {
        const nuevasRecetas = await obtenerRecetas(filters);
        renderizarRecetas(nuevasRecetas, 'recipes-grid', true);
        
        const loadMoreBtn = document.getElementById('load-more');
        
        if (nuevasRecetas.length < RECIPES_PER_PAGE) {
            loadMoreBtn.classList.add('none');
        }
        
    } catch (error) {
        console.error('Error cargando más recetas:', error);
    }
}

// ================= FUNCIONES DE CARGA INICIAL =================

async function cargarRecetas() {
    try {
        // Cargar recetas destacadas
        const destacadas = await obtenerRecetas({ featured: true, limit: 6 });
        renderizarRecetas(destacadas, 'featured-grid');
        
        // Cargar todas las recetas
        const todasLasRecetas = await obtenerRecetas({ limit: RECIPES_PER_PAGE });
        renderizarRecetas(todasLasRecetas, 'recipes-grid');
        recetas = todasLasRecetas;
        
        // Mostrar botón "Cargar más" si hay más recetas
        const loadMoreBtn = document.getElementById('load-more');
        if (todasLasRecetas.length === RECIPES_PER_PAGE) {
            loadMoreBtn.classList.remove('none');
        }
        
    } catch (error) {
        console.error('Error cargando recetas:', error);
        showToast('Error al cargar las recetas', 'error');
    }
}

async function cargarCategorias() {
    try {
        categorias = await obtenerCategorias();
        renderizarCategorias(categorias);
        llenarSelectCategorias();
    } catch (error) {
        console.error('Error cargando categorías:', error);
    }
}

async function cargarRecomendaciones() {
    if (!usuarioActual) return;
    
    try {
        const recomendaciones = await obtenerRecomendaciones(usuarioActual.email);
        renderizarRecomendaciones(recomendaciones);
    } catch (error) {
        console.error('Error cargando recomendaciones:', error);
    }
}

// ================= EVENT LISTENERS =================

// Autenticación
document.getElementById("google-login").addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    loginWithProvider(provider);
});

document.getElementById("microsoft-login").addEventListener('click', () => {
    const provider = new firebase.auth.OAuthProvider("microsoft.com");
    loginWithProvider(provider);
});

document.getElementById("logout").addEventListener('click', () => {
    auth.signOut().then(() => {
        usuarioLogueado = false;
        usuarioActual = null;
        favoritos = [];
        listaCompras = [];
        
        document.getElementById("user-status").textContent = "Explora como invitado o inicia sesión";
        document.getElementById("google-login").style.display = "inline";
        document.getElementById("microsoft-login").style.display = "inline";
        document.getElementById("logout").style.display = "none";
        document.getElementById("student-status").classList.add("none");
        
        mostrarElementosUsuario(false);
        actualizarContadorFavoritos();
        actualizarContadorCompras();
        
        showToast('Sesión cerrada correctamente', 'info');
    });
});

// Monitor de estado de autenticación
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const email = user.email;
        const domain = email.split('@')[1];
        const allowedDomains = ["ucatolica.edu.co", "gmail.com"];
        
        if (allowedDomains.includes(domain)) {
            try {
                usuarioActual = await crearOActualizarUsuario(email, user.displayName);
                usuarioLogueado = true;
                
                document.getElementById("user-status").textContent = `¡Hola, ${user.displayName}!`;
                document.getElementById("google-login").style.display = "none";
                document.getElementById("microsoft-login").style.display = "none";
                document.getElementById("logout").style.display = "inline";
                
                mostrarElementosUsuario(true);
                
                if (usuarioActual.is_student) {
                    document.getElementById("student-status").classList.remove("none");
                }
                
                await cargarDatosUsuario();
                
            } catch (error) {
                console.error("Error al cargar usuario:", error);
            }
        }
    } else {
        usuarioLogueado = false;
        usuarioActual = null;
        favoritos = [];
        listaCompras = [];
        mostrarElementosUsuario(false);
    }
});

// Búsqueda y filtros
document.getElementById('recipe-search').addEventListener('input', 
    debounce(buscarRecetas, 500)
);

document.getElementById('difficulty-filter').addEventListener('change', buscarRecetas);
document.getElementById('time-filter').addEventListener('change', buscarRecetas);
document.getElementById('category-filter').addEventListener('change', buscarRecetas);

// Botones de acción
document.getElementById('add-recipe-btn').addEventListener('click', abrirModalAgregarReceta);
document.getElementById('create-recipe-hero').addEventListener('click', abrirModalAgregarReceta);
document.getElementById('favorites-btn').addEventListener('click', abrirSidebarFavoritos);
document.getElementById('shopping-list-btn').addEventListener('click', abrirSidebarCompras);
document.getElementById('load-more').addEventListener('click', cargarMasRecetas);

// Modales
document.getElementById('close-recipe-modal').addEventListener('click', cerrarModalReceta);
document.getElementById('close-add-recipe-modal').addEventListener('click', cerrarModalAgregarReceta);
document.getElementById('cancel-recipe').addEventListener('click', cerrarModalAgregarReceta);

// Sidebars
document.getElementById('close-favorites').addEventListener('click', () => {
    document.getElementById('favorites-sidebar').classList.add('none');
});

document.getElementById('close-shopping').addEventListener('click', () => {
    document.getElementById('shopping-sidebar').classList.add('none');
});

// Formulario de receta
document.getElementById('add-recipe-form').addEventListener('submit', procesarFormularioReceta);
document.getElementById('add-ingredient-btn').addEventListener('click', agregarIngrediente);

// Comentarios
document.getElementById('add-comment-btn').addEventListener('click', async () => {
    if (!usuarioLogueado) {
        showToast('Debes iniciar sesión para comentar', 'error');
        return;
    }
    
    const content = document.getElementById('comment-input').value.trim();
    if (!content) {
        showToast('Escribe un comentario', 'error');
        return;
    }
    
    // Obtener el ID de la receta actual del modal
    const recipeId = document.getElementById('recipe-modal').dataset.recipeId;
    
    try {
        await agregarComentario(recipeId, content, usuarioActual.email);
        document.getElementById('comment-input').value = '';
        await cargarComentarios(recipeId);
        showToast('Comentario agregado', 'success');
    } catch (error) {
        showToast('Error al agregar comentario', 'error');
    }
});

// Navegación suave
function scrollToRecipes() {
    document.getElementById('recipes').scrollIntoView({ behavior: 'smooth' });
}

// Lista de compras
document.getElementById('clear-shopping-list').addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres limpiar la lista de compras?')) {
        listaCompras = [];
        actualizarContadorCompras();
        abrirSidebarCompras(); // Actualizar vista
        showToast('Lista de compras limpiada', 'info');
    }
});

document.getElementById('export-shopping-list').addEventListener('click', () => {
    if (listaCompras.length === 0) {
        showToast('La lista de compras está vacía', 'error');
        return;
    }
    
    const texto = listaCompras.map(item => 
        `${item.ingredient} - ${item.quantity} (${item.recipe_name})`
    ).join('\n');
    
    const blob = new Blob([texto], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lista-de-compras.txt';
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Lista de compras exportada', 'success');
});

// Modo oscuro
document.getElementById('dark-mode-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    
    const icon = document.querySelector('#dark-mode-toggle i');
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    
    localStorage.setItem('dark-mode', isDark.toString());
});

// Navegación responsiva
document.getElementById('nav-toggle').addEventListener('click', () => {
    const navMenu = document.getElementById('nav-menu');
    navMenu.classList.toggle('active');
});

// Cerrar modales al hacer clic fuera
document.addEventListener('click', (event) => {
    // Cerrar modales
    if (event.target.classList.contains('modal')) {
        event.target.classList.add('none');
        document.body.style.overflow = 'auto';
    }
    
    // Cerrar sidebars
    const sidebars = ['favorites-sidebar', 'shopping-sidebar'];
    sidebars.forEach(sidebarId => {
        const sidebar = document.getElementById(sidebarId);
        if (!sidebar.classList.contains('none') && 
            !sidebar.contains(event.target) && 
            !event.target.closest(`[onclick*="${sidebarId}"]`)) {
            sidebar.classList.add('none');
        }
    });
});

// ================= FUNCIONES AUXILIARES =================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Actualizar el ID de receta en el modal para comentarios
function abrirModalReceta(recipeId) {
    const modal = document.getElementById('recipe-modal');
    modal.dataset.recipeId = recipeId;
    // ... resto del código de abrirModalReceta
}

// ================= INICIALIZACIÓN =================

document.addEventListener('DOMContentLoaded', async function() {
    // Cargar preferencia de modo oscuro
    const darkModePreference = localStorage.getItem('dark-mode');
    if (darkModePreference === 'true') {
        document.body.classList.add('dark-mode');
        document.querySelector('#dark-mode-toggle i').className = 'fas fa-sun';
    }
    
    // Cargar datos iniciales
    showLoading(true);
    
    try {
        await Promise.all([
            cargarCategorias(),
            cargarRecetas()
        ]);
    } catch (error) {
        console.error('Error en la inicialización:', error);
        showToast('Error al cargar la aplicación', 'error');
    } finally {
        showLoading(false);
    }
    
    // Animaciones de entrada
    setTimeout(() => {
        document.querySelectorAll('.recipe-card, .category-card').forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }, 500);
});

// ================= ESTILOS DINÁMICOS =================

const additionalStyles = `
    <style>
    .recipe-card, .category-card {
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.6s ease;
    }
    
    .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .toast {
        background: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 300px;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        border-left: 4px solid #007bff;
    }
    
    .toast.show {
        transform: translateX(0);
    }
    
    .toast-success {
        border-left-color: #28a745;
        background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
    }
    
    .toast-error {
        border-left-color: #dc3545;
        background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
    }
    
    .toast-info {
        border-left-color: #17a2b8;
        background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
    }
    
    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #6c757d;
    }
    
    .empty-state i {
        font-size: 4rem;
        margin-bottom: 1rem;
        opacity: 0.5;
    }
    
    .empty-state h3 {
        margin-bottom: 0.5rem;
        color: #495057;
    }
    
    .loading-spinner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.9);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    }
    
    .spinner i {
        font-size: 3rem;
        color: #ff6b35;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .dark-mode .toast {
        background: #343a40;
        color: white;
    }
    
    .dark-mode .loading-spinner {
        background: rgba(33,37,41,0.9);
        color: white;
    }
    
    .dark-mode .empty-state {
        color: #adb5bd;
    }
    
    .dark-mode .empty-state h3 {
        color: #e9ecef;
    }
    
    /* Animaciones adicionales */
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .recipe-card:hover {
        animation: pulse 0.6s ease-in-out;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
    }
    
    /* Responsive improvements */
    @media (max-width: 768px) {
        .toast-container {
            right: 10px;
            left: 10px;
        }
        
        .toast {
            min-width: auto;
        }
    }
    </style>
`;

document.head.insertAdjacentHTML('beforeend', additionalStyles);
    
    try {
        const resultados = await obtenerRecetas(filters);
        renderizarRecetas(resultados, 'recipes-grid', false);
        
        currentPage = 0;
        const loadMoreBtn = document.getElementById('load-more');
        
        if (resultados.length === RECIPES_PER_PAGE) {
            loadMoreBtn.classList.remove('none');
        } else {
            loadMoreBtn.classList.add('none');
        }
        
        // Scroll a la sección de recetas
        document.getElementById('recipes').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
    }


function filtrarPorCategoria(categoryName) {
    document.getElementById('category-filter').value = categoryName;
    buscarRecetas();
}

async function cargarMasRecetas() {
    currentPage++;
    
    const filters = {
        limit: RECIPES_PER_PAGE,
        skip: currentPage * RECIPES_PER_PAGE
    };
    
    // Aplicar filtros actuales
    const searchTerm = document.getElementById('recipe-search').value.trim();
    const difficulty = document.getElementById('difficulty-filter').value;
    const maxTime = document.getElementById('time-filter').value;
    const category = document.getElementById('category-filter').value;
    
    if (searchTerm) filters.search = searchTerm;
    if (difficulty) filters.difficulty = difficulty;
    if (maxTime) filters.max_time = parseInt(maxTime);}
