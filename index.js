const API_BASE = "https://openapi.programming-hero.com/api";

// utility selector
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// global state
let categoriesList = [];
let selectedCategoryId = "";
let selectedCategoryName = "";
let plantsCache = {}; // cache by category id
let cart = []; // { id, name, price, categoryName, raw }
const LS_CART_KEY = "green_earth_cart_v1";

// initialize layout and load
const init = () => {
  renderShell();
  loadCartFromStorage();
  loadCategories();
  loadPlantsByCategory(""); // load all by default
  addGlobalModalCloseListeners();
};

// Render main shell inside #card_div
const renderShell = () => {
  const cardDiv = document.getElementById("card_div");
  cardDiv.innerHTML = `
    <div class="container w-14/15 mx-auto">
      <div class="flex flex-col md:flex-row gap-3">
        <!-- categories (left) -->
        <aside id="categories_container" class="md:w-3/15 w-full">
          <div id="categories" class="bg-white rounded-lg p-4 shadow"></div>
        </aside>

        <!-- plants (middle) -->
        <main id="plants_container" class="md:w-9/15 w-full">
          <div id="plants_top" class="mb-4 flex justify-between items-center">
            <div id="plants_loader_place"></div>
          </div>
          <div id="plants_grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>
        </main>

        <!-- cart (right) -->
        <aside id="cart_container" class="md:w-3/15 w-full">
          <div id="cart_box" class="bg-white rounded-lg p-4 shadow sticky top-6">
            <h3 class="text-lg font-semibold mb-3">Your Cart</h3>
            <div id="cart_items" class="space-y-2"></div>
            <div id="cart_total_box" class="border-t pt-3 mt-3">
              <div class="flex justify-between items-center">
                <span class="font-semibold">Total</span>
                <span id="cart_total" class="font-bold text-lg">৳ 0</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- modal placeholder -->
    <div id="modal_root"></div>
  `;
};

// show spinner (returns function to hide)
const showSpinnerIn = (containerSelectorOrEl) => {
  const container =
    typeof containerSelectorOrEl === "string"
      ? document.querySelector(containerSelectorOrEl)
      : containerSelectorOrEl;
  if (!container) return () => {};
  const spinner = document.createElement("div");
  spinner.innerHTML = `
    <div class="w-full flex justify-center items-center py-6" id="__temp_spinner">
      <svg class="animate-spin h-8 w-8 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
      </svg>
    </div>
  `;
  container.appendChild(spinner);
  return () => {
    const el = container.querySelector("#__temp_spinner");
    if (el) el.remove();
  };
};

// --- Categories ---
const loadCategories = () => {
  const categoriesEl = document.getElementById("categories");
  categoriesEl.innerHTML = `<p class="text-sm text-gray-600">Loading categories...</p>`;
  const hide = showSpinnerIn(categoriesEl);

  fetch(`${API_BASE}/categories`)
    .then((res) => res.json())
    .then((data) => {
      hide();
      let cats = [];
      if (Array.isArray(data.data)) cats = data.data;
      else if (data.data && Array.isArray(data.data.data))
        cats = data.data.data;
      else if (Array.isArray(data.categories)) cats = data.categories;
      else cats = [];

      categoriesList = cats;
      renderCategories();
    })
    .catch((err) => {
      hide();
      categoriesEl.innerHTML = `<p class="text-red-600">Failed to load categories.</p>`;
      console.error(err);
    });
};

const renderCategories = () => {
  const c = document.getElementById("categories");
  let html = "";
  // render categories only, All বাদ
  categoriesList.forEach((cat) => {
    const catId =
      cat.id ||
      cat._id ||
      cat.category_id ||
      cat.categoryId ||
      cat.category_id_string ||
      "";
    const catName =
      cat.category_name ||
      cat.categoryName ||
      cat.name ||
      cat.category ||
      "Unnamed";
    html += `<button data-id="${
      catId || catName
    }" class="category-btn w-full text-left px-3 py-2 rounded mb-2 border hover:bg-green-50">${catName}</button>`;
  });

  c.innerHTML = html;

  const btns = c.querySelectorAll(".category-btn");
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // remove active from others
      btns.forEach((b) => {
        b.classList.remove("bg-[#15803d]", "text-white");
        b.classList.add("hover:bg-green-50"); // hover পুনরায় চালু
      });
      btn.classList.add("bg-[#15803d]", "text-white");
      btn.classList.remove("hover:bg-green-50"); // active হলে hover বাদ
      selectedCategoryId = btn.getAttribute("data-id");
      selectedCategoryName = btn.textContent.trim();
      loadPlantsByCategory(selectedCategoryId);
    });
  });

  // কোন বাটন ডিফল্টভাবে active নয়
};

// --- Plants Loading ---
const loadPlantsByCategory = (categoryId) => {
  const grid = document.getElementById("plants_grid");
  grid.innerHTML = "";
  const plantsTopLoaderPlace = document.getElementById("plants_loader_place");
  const hideTopSpinner = showSpinnerIn(plantsTopLoaderPlace);
  const hideGridSpinner = showSpinnerIn(grid);

  if (plantsCache[categoryId]) {
    hideTopSpinner();
    hideGridSpinner();
    renderPlants(plantsCache[categoryId]);
    return;
  }

  let url = categoryId
    ? `${API_BASE}/category/${categoryId}`
    : `${API_BASE}/plants`;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      hideTopSpinner();
      hideGridSpinner();

      let plants = [];
      if (Array.isArray(data.data)) plants = data.data;
      else if (data.data && Array.isArray(data.data.data))
        plants = data.data.data;
      else if (Array.isArray(data.plants)) plants = data.plants;
      else if (Array.isArray(data.data?.plants)) plants = data.data.plants;
      else plants = [];

      const normalized = plants.map((p) => {
        const id =
          p.id ||
          p._id ||
          p.plant_id ||
          p.plantId ||
          p.slug ||
          JSON.stringify(p).slice(0, 8);
        const name =
          p.name || p.plant_name || p.common_name || p.title || "Unnamed Plant";
        const description =
          p.description ||
          p.short_description ||
          p.details ||
          (p.about && typeof p.about === "string" ? p.about : "") ||
          "No description available.";
        const image =
          p.image ||
          p.img ||
          p.image_url ||
          (p.images && Array.isArray(p.images) ? p.images[0] : null) ||
          "./assets/placeholder.png";
        const categoryName =
          p.category_name || p.category || selectedCategoryName || "Unknown";
        let price = p.price
          ? Number(p.price)
          : p.price_tk
          ? Number(p.price_tk)
          : p.price_usd
          ? Number(p.price_usd)
          : 100;
        return { id, name, description, image, categoryName, price, raw: p };
      });

      plantsCache[categoryId] = normalized;
      renderPlants(normalized);
    })
    .catch((err) => {
      hideTopSpinner();
      hideGridSpinner();
      grid.innerHTML = `<p class="text-red-600">Failed to load plants. Try again later.</p>`;
      console.error(err);
    });
};

const renderPlants = (plants) => {
  const grid = document.getElementById("plants_grid");
  grid.innerHTML = "";

  if (!plants || plants.length === 0) {
    grid.innerHTML = `<p class="text-gray-600">No plants found in this category.</p>`;
    return;
  }

  for (const p of plants) {
    const card = document.createElement("div");
    card.className = "bg-white rounded-lg p-4 shadow flex flex-col";
    card.innerHTML = `
      <div class="h-44 overflow-hidden rounded">
        <img src="${p.image}" alt="${escapeHtml(
      p.name
    )}" class="w-full h-full object-cover">
      </div>
      <h3 class="plant-name mt-3 text-lg font-semibold cursor-pointer" data-id="${
        p.id
      }" style="line-height:1.1;">${escapeHtml(p.name)}</h3>
      <p class="text-sm mt-2 text-gray-600 line-clamp-3">${escapeHtml(
        truncate(p.description, 120)
      )}</p>
      <div class="mt-auto">
        <div class="flex justify-between items-center mt-4">
          <span class="text-sm text-gray-700">${escapeHtml(
            p.categoryName
          )}</span>
          <span class="font-semibold">৳ ${formatPrice(p.price)}</span>
        </div>
        <button class="add-to-cart mt-3 w-full py-2 rounded-lg bg-green-600 text-white font-semibold">Add to Cart</button>
      </div>
    `;

    const nameEl = card.querySelector(".plant-name");
    nameEl.addEventListener("click", () => showPlantModal(p));

    const addBtn = card.querySelector(".add-to-cart");
    addBtn.addEventListener("click", () => {
      if (
        confirm(`"${p.name}" has been added to the cart. Click OK to confirm.`)
      ) {
        addToCart(p);
      }
    });

    grid.appendChild(card);
  }
};

// --- Cart functions ---
const addToCart = (plant) => {
  cart.push({
    id: plant.id + "-" + Math.random().toString(36).slice(2, 7),
    name: plant.name,
    price: Number(plant.price),
    image: null, // ছবি থাকবে না
    categoryName: plant.categoryName,
    raw: plant.raw,
  });
  saveCartToStorage();
  renderCart();
};

const removeFromCart = (cartItemId) => {
  cart = cart.filter((c) => c.id !== cartItemId);
  saveCartToStorage();
  renderCart();
};

const calculateTotal = () => {
  return cart.reduce((acc, it) => acc + Number(it.price || 0), 0);
};

const renderCart = () => {
  const el = document.getElementById("cart_items");
  el.innerHTML = "";

  if (cart.length === 0) {
    el.innerHTML = `<p class="text-gray-600">Your cart is empty.</p>`;
  } else {
    cart.forEach((item) => {
      const row = document.createElement("div");
      row.className = "flex items-center justify-between gap-2";
      row.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="text-sm">
            <div class="font-medium">${escapeHtml(item.name)}</div>
            <div class="text-xs text-gray-500">${escapeHtml(
              item.categoryName
            )}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="font-semibold">৳ ${formatPrice(item.price)}</div>
          <button title="Remove" class="remove-cart-item text-red-500 text-lg">❌</button>
        </div>
      `;
      const removeBtn = row.querySelector(".remove-cart-item");
      removeBtn.addEventListener("click", () => removeFromCart(item.id));
      el.appendChild(row);
    });
  }

  const totalEl = document.getElementById("cart_total");
  totalEl.textContent = `৳ ${formatPrice(calculateTotal())}`;
};

const saveCartToStorage = () => {
  try {
    localStorage.setItem(LS_CART_KEY, JSON.stringify(cart));
  } catch (e) {
    console.warn("Could not save cart to localStorage", e);
  }
};

const loadCartFromStorage = () => {
  try {
    const raw = localStorage.getItem(LS_CART_KEY);
    if (raw) cart = JSON.parse(raw);
  } catch (e) {
    cart = [];
  }
  renderCart();
};

// --- Modal for plant details ---
const showPlantModal = (plant) => {
  const root = document.getElementById("modal_root");
  root.innerHTML = `
    <div id="modal_overlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg w-11/12 md:w-8/12 lg:w-6/12 p-4 relative max-h-[90vh] overflow-auto">
        <button id="modal_close_btn" class="absolute top-3 right-3 text-lg">✖</button>
        <div class="flex flex-col md:flex-row gap-4">
          <div class="md:w-1/2">
            <img src="${plant.image}" alt="${escapeHtml(
    plant.name
  )}" class="w-full h-64 object-cover rounded">
          </div>
          <div class="md:w-1/2">
            <h2 class="text-2xl font-semibold mb-2">${escapeHtml(
              plant.name
            )}</h2>
            <p class="text-sm text-gray-600 mb-3">${escapeHtml(
              plant.categoryName
            )} · ৳ ${formatPrice(plant.price)}</p>
            <p class="text-sm text-gray-700 mb-4">${escapeHtml(
              plant.description
            )}</p>
            <div>
              <button id="modal_add_cart" class="w-full py-2 rounded bg-green-600 text-white font-semibold">Add to Cart</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  const overlay = document.getElementById("modal_overlay");
  const closeBtn = document.getElementById("modal_close_btn");
  const addBtn = document.getElementById("modal_add_cart");

  const closeModal = () => {
    root.innerHTML = "";
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  closeBtn.addEventListener("click", closeModal);
  addBtn.addEventListener("click", () => {
    addToCart(plant);
    closeModal();
  });
};

const addGlobalModalCloseListeners = () => {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const root = document.getElementById("modal_root");
      if (root) root.innerHTML = "";
    }
  });
};

// ----------------- helpers -----------------
const escapeHtml = (unsafe) => {
  if (!unsafe) return "";
  return String(unsafe)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};
const truncate = (str, n) =>
  str && str.length > n ? str.slice(0, n) + "…" : str;
const formatPrice = (num) => {
  if (isNaN(num)) return "0";
  return Number(num).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
};

// initialize app on DOM ready
document.addEventListener("DOMContentLoaded", init);
