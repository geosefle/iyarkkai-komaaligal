// @ts-nocheck
// Firebase Firestore SDK Imports
import { collection, addDoc, getDocs, doc, setDoc, getDoc, query, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let cart = [];

// ========================================================
// 📲 TELEGRAM NOTIFICATION CONFIGURATION (MULTI-CHAT)
// ========================================================
const TELEGRAM_BOT_TOKEN = "8800472610:AAFTM4UwoaN1-Ip0RIz42xiChNszhbt5btk";

// இங்கு நீங்கள் எத்தனை Chat ID வேண்டுமானாலும் கமா (,) போட்டுச் சேர்த்துக் கொள்ளலாம்
const TELEGRAM_CHAT_IDS = ["7068750895", "இன்னொரு_CHAT_ID_இங்கே"]; 

async function sendTelegramNotification(messageText) {
  // அனைத்து Chat ID-களுக்கும் மெசேஜ் அனுப்ப Loop பயன்படுத்தப்படுகிறது
  for (const chatId of TELEGRAM_CHAT_IDS) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'HTML'
        })
      });
    } catch (error) {
      console.error(`Telegram Error for ${chatId}:`, error);
    }
  }
}
document.addEventListener('DOMContentLoaded', () => {

    // 1. DARK / LIGHT THEME TOGGLE
    const themeToggleBtn = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const theme = document.documentElement.getAttribute('data-theme');
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
        });
    }

    // 2. MOBILE MENU TOGGLE
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('nav-menu');
    if (mobileBtn && navMenu) {
        mobileBtn.addEventListener('click', () => {
            navMenu.classList.toggle('show');
        });
    }

    // 3. FETCH PRODUCTS FROM FIREBASE
    setTimeout(() => {
      fetchStockFromFirebase();
    }, 500);
    
    updateExperience();
    initAdminPanel();
    initCartAndCheckoutEvents();
});

// ========================================================
// 📩 CONTACT FORM HANDLER (ALL 8 FIELDS TELEGRAM ALERT)
// ========================================================
const contactForm = document.getElementById('contact-form');
const formStatus = document.getElementById('form-status');

if (contactForm && formStatus) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-btn');
    if(submitBtn) submitBtn.disabled = true;

    formStatus.className = 'form-status';
    formStatus.innerText = 'அனுப்பப்படுகிறது...';

    const formData = new FormData(contactForm);
    
    // 8 ஃபீல்டுகளின் விவரங்களையும் பெறுதல்
    const name = formData.get("name") || "";
    const phone = formData.get("phone") || "";
    const email = formData.get("email") || "";
    const district = formData.get("district") || "";
    const subject = formData.get("subject") || "";
    const preferredDate = formData.get("preferred_date") || "";
    const preferredTime = formData.get("preferred_time") || "";
    const message = formData.get("message") || "";
    
    try {
      // 1. Save to Firebase Database
      await addDoc(collection(window.db, "messages"), {
        name,
        phone,
        email,
        district,
        subject,
        preferredDate,
        preferredTime,
        message,
        createdAt: new Date()
      });

      // 2. Send Telegram Notification (அனைத்து 8 ஃபீல்டுகளுடன்)
      const telegramMsg = `📩 <b>புதிய தொடர்பு செய்தி! (Contact Form)</b>\n\n` +
        `👤 <b>பெயர்:</b> ${name}\n` +
        `📞 <b>போன்:</b> ${phone}\n` +
        `✉️ <b>Email:</b> ${email || 'வழங்கப்படவில்லை'}\n` +
        `📍 <b>மாவட்டம்:</b> ${district || 'தேர்ந்தெடுக்கப்படவில்லை'}\n` +
        `📌 <b>காரணம்:</b> ${subject || 'தேர்ந்தெடுக்கப்படவில்லை'}\n` +
        `📅 <b>கால் செய்ய வேண்டிய தேதி:</b> ${preferredDate || 'குறிப்பிடப்படவில்லை'}\n` +
        `⏰ <b>கால் செய்ய வேண்டிய நேரம்:</b> ${preferredTime || 'குறிப்பிடப்படவில்லை'}\n` +
        `💬 <b>செய்தி:</b> ${message}`;

      await sendTelegramNotification(telegramMsg);

      formStatus.className = 'form-status success';
      formStatus.innerText = '✅ நன்றி! உங்கள் செய்தி வெற்றிகரமாக அனுப்பப்பட்டது.';
      contactForm.reset();
      if(submitBtn) submitBtn.disabled = false;

    } catch (error) {
      console.error("Firebase Error:", error);
      formStatus.className = 'form-status error';
      formStatus.innerText = '❌ அனுப்புவதில் தவறு ஏற்பட்டது.';
      if(submitBtn) submitBtn.disabled = false;
    }
  });
}

// ========================================================
// 🛍️ FETCH PRODUCTS & REAL-TIME STOCK FROM FIREBASE
// ========================================================
async function fetchStockFromFirebase() {
  if (!window.db) {
    setTimeout(fetchStockFromFirebase, 500);
    return;
  }

  const productsGrid = document.getElementById('products-grid');
  if (!productsGrid) return;

  try {
    const querySnapshot = await getDocs(collection(window.db, "products"));
    
    if (querySnapshot.empty) {
      productsGrid.innerHTML = '<p style="text-align: center;">பொருட்கள் எதுவும் கிடைக்கவில்லை.</p>';
      return;
    }

    productsGrid.innerHTML = ''; 

    querySnapshot.forEach((docSnap) => {
      const item = { id: docSnap.id, ...docSnap.data() };
      
      const cartItem = cart.find(c => c.id === item.id);
      const inCartQty = cartItem ? cartItem.qty : 0;
      const effectiveStock = item.stock - inCartQty;

      const isOutOfStock = effectiveStock <= 0;
      
      const stockHTML = isOutOfStock 
        ? '<span class="out-of-stock-text" style="color:red; font-weight:bold;">கையிருப்பில் இல்லை (Out of Stock)</span>' 
        : `கையிருப்பு: <span class="stock-count" style="font-weight:bold;">${effectiveStock}</span> <span class="stock-uom">${item.uom || ''}</span>`;

      const btnHTML = isOutOfStock
        ? '<button type="button" class="add-to-cart-btn" disabled style="opacity:0.6; cursor:not-allowed;">Out of Stock ❌</button>'
        : '<button type="button" class="add-to-cart-btn">Add to Cart 🛒</button>';

      const productCard = document.createElement('div');
      productCard.className = 'product-card';
      productCard.setAttribute('data-id', item.id);

      productCard.innerHTML = `
        <div class="product-img-box">
          <img src="${item.imageUrl || item.image || 'placeholder.jpg'}" alt="${item.name}" class="product-img">
        </div>
        
        <div class="product-content">
          <h3 class="product-title">${item.name}</h3>
          <p class="product-desc" style="font-size: 0.9rem; color: var(--text-muted); margin: 5px 0;">${item.description || ''}</p>
          <div class="product-stock" style="margin-bottom: 10px;">${stockHTML}</div>
          
          <div class="product-action-row" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid #eee; padding-top: 10px;">
            <div class="price-container">
              <span class="product-price" style="font-size: 1.25rem; font-weight: bold; color: var(--accent-color, #2e7d32);">₹${item.price}</span>
              <span class="price-uom" style="color: var(--text-muted); font-size: 0.85rem;">/ ${item.weight || item.uom || ''}</span>
            </div>
            <div class="btn-container" style="flex: 1; max-width: 60%;">
              ${btnHTML}
            </div>
          </div>
        </div>
      `;

      const cartBtn = productCard.querySelector('.add-to-cart-btn');
      if (cartBtn && !isOutOfStock) {
        cartBtn.addEventListener('click', (e) => {
          e.preventDefault();
          handleAddToCart(item.id, item.name, item.price, item.stock, productCard);
        });
      }

      productsGrid.appendChild(productCard);
    });

  } catch (error) {
    console.error("Fetch Stock Error:", error);
  }
}

// ========================================================
// 🛒 CART & STOCK LOGIC
// ========================================================
function handleAddToCart(id, name, price, dbStock, card) {
  const existingItem = cart.find(item => item.id === id);
  const cartQty = existingItem ? existingItem.qty : 0;

  if (dbStock - cartQty > 0) {
    if (existingItem) {
      existingItem.qty += 1;
    } else {
      cart.push({ id, name, price: Number(price), qty: 1, dbStock: Number(dbStock) });
    }

    const remainingStock = dbStock - (cartQty + 1);
    const stockElement = card ? card.querySelector('.stock-count') : null;
    const targetBtn = card ? card.querySelector('.add-to-cart-btn') : null;

    if (stockElement) {
      if (remainingStock > 0) {
        stockElement.textContent = remainingStock.toString();
      } else {
        const stockContainer = card ? card.querySelector('.product-stock') : null;
        if (stockContainer) stockContainer.innerHTML = '<span class="out-of-stock-text" style="color:red; font-weight:bold;">கையிருப்பில் இல்லை (Out of Stock)</span>';
        if (targetBtn) {
          targetBtn.disabled = true;
          targetBtn.innerText = 'Out of Stock ❌';
        }
      }
    }
    
    updateCartUI();

  } else {
    alert("மன்னிக்கவும், இந்த பொருள் கையிருப்பில் இல்லை!");
  }
}

function updateCartUI() {
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartCount = document.getElementById('cart-count');
  const cartTotalPrice = document.getElementById('cart-total-price');
  const openCheckoutBtn = document.getElementById('open-checkout-btn');

  if (!cartItemsContainer || !cartCount || !cartTotalPrice || !openCheckoutBtn) return;

  cartItemsContainer.innerHTML = '';
  let total = 0;
  let totalCount = 0;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<p class="empty-msg">உங்கள் கார்ட்டில் பொருட்கள் எதுவும் இல்லை.</p>';
    openCheckoutBtn.setAttribute('disabled', 'true');
  } else {
    cart.forEach((item, index) => {
      total += item.price * item.qty;
      totalCount += item.qty;

      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item';
      itemEl.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:8px;";
      
      itemEl.innerHTML = `
        <div>
          <strong style="display:block; font-size:0.95rem;">${item.name}</strong>
          <small style="color:#666;">₹${item.price} x ${item.qty} = ₹${item.price * item.qty}</small>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" class="qty-btn" style="padding:2px 8px; cursor:pointer;" onclick="window.changeQty(${index}, -1)">-</button>
          <span>${item.qty}</span>
          <button type="button" class="qty-btn" style="padding:2px 8px; cursor:pointer;" onclick="window.changeQty(${index}, 1)">+</button>
        </div>
      `;
      cartItemsContainer.appendChild(itemEl);
    });
    openCheckoutBtn.removeAttribute('disabled');
  }

  cartCount.innerText = totalCount.toString();
  cartTotalPrice.innerText = `₹${total}`;
}

window.changeQty = function(index, delta) {
  if (cart[index]) {
    const item = cart[index];
    if (delta > 0) {
      if (item.qty < item.dbStock) {
        item.qty += 1;
      } else {
        alert("கையிருப்பில் உள்ள அளவிற்கு மேலே சேர்க்க முடியாது!");
        return;
      }
    } else {
      item.qty -= 1;
      if (item.qty <= 0) {
        cart.splice(index, 1);
      }
    }
    updateCartUI();
    fetchStockFromFirebase();
  }
};

// ========================================================
// 💳 CHECKOUT FORM HANDLER (ORDER TELEGRAM NOTIFICATION)
// ========================================================
function initCartAndCheckoutEvents() {
  const floatingCartBtn = document.getElementById('floating-cart-btn');
  const closeCartBtn = document.getElementById('close-cart-btn');
  const cartOverlay = document.getElementById('cart-overlay');
  const cartDrawer = document.getElementById('cart-drawer');

  const openCheckoutBtn = document.getElementById('open-checkout-btn');
  const checkoutModal = document.getElementById('checkout-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const checkoutForm = document.getElementById('checkout-form');
  const checkoutStatus = document.getElementById('checkout-status');
  const modalOrderSummary = document.getElementById('modal-order-summary');

  const closeCart = () => {
    cartDrawer?.classList.remove('active');
    cartOverlay?.classList.remove('active');
  };

  if (floatingCartBtn) {
    floatingCartBtn.addEventListener('click', () => {
      cartDrawer?.classList.add('active');
      cartOverlay?.classList.add('active');
    });
  }

  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

  if (openCheckoutBtn) {
    openCheckoutBtn.addEventListener('click', () => {
      closeCart();
      if (modalOrderSummary) {
        const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        modalOrderSummary.innerHTML = `
          <ul style="padding-left:20px; margin:5px 0;">
            ${cart.map(i => `<li>${i.name} x ${i.qty} = ₹${i.price * i.qty}</li>`).join('')}
          </ul>
          <strong>மொத்தத் தொகை: ₹${totalPrice}</strong>
        `;
      }
      checkoutModal?.classList.add('active');
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      checkoutModal?.classList.remove('active');
    });
  }

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('c-name');
      const phoneInput = document.getElementById('c-phone');
      const emailInput = document.getElementById('c-email');
      const addressInput = document.getElementById('c-address');

      const customerName = nameInput ? nameInput.value.trim() : "";
      const customerPhone = phoneInput ? phoneInput.value.trim() : "";
      const customerEmail = emailInput ? emailInput.value.trim() : "";
      const customerAddress = addressInput ? addressInput.value.trim() : "";

      if (checkoutStatus) {
        checkoutStatus.className = 'form-status';
        checkoutStatus.innerText = 'ஆர்டர் அனுப்பப்படுகிறது...';
      }

      let totalAmount = 0;
      let itemsListArray = [];

      cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        totalAmount += itemTotal;
        itemsListArray.push(`• ${item.name} x ${item.qty} = ₹${itemTotal}`);
      });

      try {
        // 1. Save to Firebase Orders
        await addDoc(collection(window.db, "orders"), {
          customerName,
          customerPhone,
          customerEmail,
          customerAddress,
          orderItems: cart,
          totalAmount: `₹${totalAmount}`,
          status: 'Active',
          orderDate: new Date()
        });

        // 2. Reduce Firebase Stock
        for (let item of cart) {
          const productRef = doc(window.db, "products", item.id);
          const productSnap = await getDoc(productRef);
          
          if (productSnap.exists()) {
            const currentStock = productSnap.data().stock || 0;
            const updatedStock = Math.max(0, currentStock - item.qty);
            await setDoc(productRef, { stock: updatedStock }, { merge: true });
          }
        }

        // 3. Send Telegram Notification
        const telegramMsg = `🛒 <b>புதிய ஆர்டர் வந்துள்ளது! (New Order)</b>\n\n` +
          `👤 <b>பெயர்:</b> ${customerName}\n` +
          `📞 <b>போன்:</b> ${customerPhone}\n` +
          `✉️ <b>Email:</b> ${customerEmail || 'வழங்கப்படவில்லை'}\n` +
          `📍 <b>முகவரி:</b> ${customerAddress}\n\n` +
          `📦 <b>ஆர்டர் விவரங்கள்:</b>\n${itemsListArray.join('\n')}\n\n` +
          `💰 <b>மொத்தத் தொகை:</b> ₹${totalAmount}`;

        await sendTelegramNotification(telegramMsg);

        if (checkoutStatus) {
          checkoutStatus.className = 'form-status success';
          checkoutStatus.innerText = '🎉 நன்றி! உங்கள் ஆர்டர் வெற்றிகரமாக பதிவு செய்யப்பட்டது.';
        }

        cart = [];
        updateCartUI();

        setTimeout(() => {
          if (checkoutModal) checkoutModal.classList.remove('active');
          checkoutForm.reset();
          if (checkoutStatus) checkoutStatus.innerText = '';
          fetchStockFromFirebase();
          loadDashboardData();
        }, 2500);

      } catch (error) {
        console.error("Firebase Order Error:", error);
        if (checkoutStatus) {
          checkoutStatus.className = 'form-status error';
          checkoutStatus.innerText = '❌ மன்னிக்கவும், ஆர்டர் செய்வதில் தவறு ஏற்பட்டது.';
        }
      }
    });
  }
}

function updateExperience() {
  const startYear = 2018; 
  const currentYear = new Date().getFullYear(); 
  const expElement = document.getElementById("experience-years");
  if (expElement) {
    expElement.textContent = (currentYear - startYear).toString();
  }
}

// ========================================================
// 🛠️ ADMIN PANEL LOGIC
// ========================================================
async function getAdminCredentials() {
  if (!window.db) return { password: "admin123#iyarkkai", phone: "9876543210" };
  const docRef = doc(window.db, "settings", "admin_config");
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data();
  } else {
    const defaultConfig = { password: "admin123#iyarkkai", phone: "9876543210" };
    await setDoc(docRef, defaultConfig);
    return defaultConfig;
  }
}

window.cancelOrder = async function(orderId) {
  if (!confirm("நிச்சயமாக இந்த ஆர்டரை ரத்து (Cancel) செய்ய விரும்புகிறீர்களா?")) return;

  try {
    const orderRef = doc(window.db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);

    if (orderSnap.exists()) {
      const orderData = orderSnap.data();

      if (orderData.status === 'Cancelled') {
        alert("இந்த ஆர்டர் ஏற்கனவே ரத்து செய்யப்பட்டுவிட்டது.");
        return;
      }

      await updateDoc(orderRef, { status: 'Cancelled' });

      if (orderData.orderItems && Array.isArray(orderData.orderItems)) {
        for (let item of orderData.orderItems) {
          const productRef = doc(window.db, "products", item.id);
          const productSnap = await getDoc(productRef);

          if (productSnap.exists()) {
            const currentStock = productSnap.data().stock || 0;
            await updateDoc(productRef, { stock: currentStock + item.qty });
          }
        }
      }

      alert("🎉 ஆர்டர் ரத்து செய்யப்பட்டது! பொருட்கள் மீண்டும் stock-ல் சேர்க்கப்பட்டது.");
      loadDashboardData();
      fetchStockFromFirebase();
    }
  } catch (error) {
    console.error("Cancel Order Error:", error);
    alert("❌ ஆர்டரை ரத்து செய்வதில் தவறு ஏற்பட்டது.");
  }
};

async function loadDashboardData() {
  if (!window.db) return;
  
  try {
    const prodDocs = await getDocs(collection(window.db, "products"));
    const prodCountEl = document.getElementById('total-products-count');
    if (prodCountEl) prodCountEl.innerText = prodDocs.size.toString();

    const ordersQuery = query(collection(window.db, "orders"), orderBy("orderDate", "desc"));
    let orderDocs;
    
    try {
      orderDocs = await getDocs(ordersQuery);
    } catch(e) {
      orderDocs = await getDocs(collection(window.db, "orders"));
    }

    let totalRev = 0;
    let validOrdersCount = 0;
    let ordersHTML = "";

    let ordersList = [];
    orderDocs.forEach(docSnap => {
      ordersList.push({ id: docSnap.id, ...docSnap.data() });
    });

    ordersList.sort((a, b) => {
      let dateA = a.orderDate?.seconds ? a.orderDate.seconds : new Date(a.orderDate || 0).getTime();
      let dateB = b.orderDate?.seconds ? b.orderDate.seconds : new Date(b.orderDate || 0).getTime();
      return dateB - dateA;
    });

    ordersList.forEach((order) => {
      const rawAmount = parseFloat((order.totalAmount || "0").toString().replace(/[^0-9.]/g, '')) || 0;
      const isCancelled = order.status === 'Cancelled';

      if (!isCancelled) {
        totalRev += rawAmount;
        validOrdersCount++;
      }

      const name = order.customerName || order.name || 'பெயர் இல்லை';
      const phone = order.customerPhone || order.phone || order.mobile || 'எண் இல்லை';
      const address = order.customerAddress || order.address || 'முகவரி இல்லை';

      let itemsListHTML = "";
      if (order.orderItems && Array.isArray(order.orderItems)) {
        itemsListHTML = order.orderItems.map((item) => 
          `<li style="font-size: 0.85rem; color: #333;">${item.name} x ${item.qty} = ₹${item.price * item.qty}</li>`
        ).join('');
      }

      ordersHTML += `
        <div class="product-card" style="margin-bottom: 12px; background: ${isCancelled ? '#ffebee' : '#ffffff'}; border: 1px solid ${isCancelled ? '#ffcdd2' : '#e0e0e0'}; border-radius: 12px; padding: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 8px;">
            <h4 style="margin: 0; color: #2e7d32; font-size: 1.05rem;">👤 ${name} ${isCancelled ? '<span style="color:red; font-size:0.8rem;">(Cancelled)</span>' : ''}</h4>
            <span style="background: ${isCancelled ? '#ffcdd2' : '#e8f5e9'}; color: ${isCancelled ? '#b71c1c' : '#1b5e20'}; font-weight: bold; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">${order.totalAmount || `₹${rawAmount}`}</span>
          </div>

          <p style="margin: 4px 0; font-size: 0.88rem; color: #333333;">
            <strong style="color: #111111;">📞 போன்:</strong> <span style="color: #444444;">${phone}</span>
          </p>
          
          <p style="margin: 4px 0; font-size: 0.88rem; color: #333333;">
            <strong style="color: #111111;">📍 முகவரி:</strong> <span style="color: #444444;">${address}</span>
          </p>
          
          ${itemsListHTML ? `
            <div style="margin-top: 8px; background: #f8f9fa; padding: 8px 10px; border-radius: 8px; border: 1px dashed #cccccc;">
              <p style="margin: 0 0 4px 0; font-weight: bold; font-size: 0.82rem; color: #2e7d32;">📦 வாங்கிய பொருட்கள்:</p>
              <ul style="margin: 0; padding-left: 18px; color: #222222;">
                ${itemsListHTML}
              </ul>
            </div>
          ` : ''}

          <div style="margin-top: 10px; text-align: right;">
            ${!isCancelled ? `
              <button onclick="window.cancelOrder('${order.id}')" style="background: #d32f2f; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.82rem;">❌ Cancel Order</button>
            ` : `
              <span style="color: #d32f2f; font-weight: bold; font-size: 0.85rem;">ரத்து செய்யப்பட்டது</span>
            `}
          </div>
        </div>
      `;
    });

    const orderCountEl = document.getElementById('total-orders-count');
    if (orderCountEl) orderCountEl.innerText = validOrdersCount.toString();

    const revEl = document.getElementById('total-revenue');
    if (revEl) revEl.innerText = `₹${totalRev}`;
    
    const ordersContainer = document.getElementById('orders-list-container');
    if (ordersContainer) {
      ordersContainer.innerHTML = ordersHTML || '<p style="color: #888; font-size: 0.9rem; text-align:center;">ஆர்டர்கள் எதுவும் இல்லை.</p>';
    }

    let msgDocs;
    try {
      const msgQuery = query(collection(window.db, "messages"), orderBy("createdAt", "desc"));
      msgDocs = await getDocs(msgQuery);
    } catch(e) {
      msgDocs = await getDocs(collection(window.db, "messages"));
    }

    let messagesList = [];
    msgDocs.forEach(docSnap => {
      messagesList.push({ id: docSnap.id, ...docSnap.data() });
    });

    messagesList.sort((a, b) => {
      let dateA = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt || 0).getTime();
      let dateB = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    let messagesHTML = "";
    messagesList.forEach((msg) => {
      const name = msg.name || 'பெயர் இல்லை';
      const phone = msg.phone || 'எண் இல்லை';
      const email = msg.email || 'இமெயில் இல்லை';
      const district = msg.district || 'இல்லை';
      const subject = msg.subject || 'இல்லை';
      const preferredDate = msg.preferredDate || 'இல்லை';
      const preferredTime = msg.preferredTime || 'இல்லை';
      const message = msg.message || 'செய்தி இல்லை';

      messagesHTML += `
        <div class="product-card" style="margin-bottom: 12px; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 8px;">
            <h4 style="margin: 0; color: #2e7d32; font-size: 1.05rem;">👤 ${name}</h4>
            <span style="font-size: 0.8rem; color: #777;">📞 ${phone}</span>
          </div>

          <p style="margin: 4px 0; font-size: 0.85rem; color: #555;">
            <strong>📍 மாவட்டம்:</strong> ${district} | <strong>📌 காரணம்:</strong> ${subject}
          </p>
          <p style="margin: 4px 0; font-size: 0.85rem; color: #555;">
            <strong>📅 அழைப்பு நேரம்:</strong> ${preferredDate} (${preferredTime})
          </p>

          ${email !== 'இமெயில் இல்லை' ? `
            <p style="margin: 4px 0; font-size: 0.85rem; color: #555;">
              <strong>✉️ Email:</strong> ${email}
            </p>
          ` : ''}

          <div style="margin-top: 8px; background: #f9f9f9; padding: 10px; border-radius: 8px; border-left: 3px solid #2e7d32;">
            <p style="margin: 0; font-size: 0.9rem; color: #333; line-height: 1.4;">
              💬 "${message}"
            </p>
          </div>
        </div>
      `;
    });

    const messagesContainer = document.getElementById('messages-list-container');
    if (messagesContainer) {
      messagesContainer.innerHTML = messagesHTML || '<p style="color: #888; font-size: 0.9rem; text-align:center;">செய்திகள் எதுவும் இல்லை.</p>';
    }

  } catch (err) {
    console.error("Dashboard Load Error:", err);
  }
}

function initAdminPanel() {
  const loginBtn = document.getElementById('login-btn');
  const loginPass = document.getElementById('admin-pass');
  const loginError = document.getElementById('login-error');
  const loginSection = document.getElementById('login-section');
  const adminPanel = document.getElementById('admin-panel');
  const logoutBtn = document.getElementById('logout-btn');

  if (loginBtn && loginPass) {
    loginBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (loginError) loginError.style.display = 'none';
      loginBtn.innerText = 'சரிபார்க்கப்படுகிறது...';

      try {
        const config = await getAdminCredentials();
        if (loginPass.value.trim() === config.password) {
          if (loginSection) loginSection.style.display = 'none';
          if (adminPanel) adminPanel.style.display = 'block';
          loginPass.value = '';
          loadDashboardData();
        } else {
          if (loginError) {
            loginError.style.display = 'block';
            loginError.innerText = '❌ தவறான கடவுச்சொல்!';
          }
        }
      } catch (err) {
        console.error("Login Error:", err);
      } finally {
        loginBtn.innerText = 'உள்நுழை (Login)';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (adminPanel) adminPanel.style.display = 'none';
      if (loginSection) loginSection.style.display = 'block';
    });
  }

  const changePassBtn = document.getElementById('change-pass-btn');
  const changePassStatus = document.getElementById('change-pass-status');
  if (changePassBtn && changePassStatus) {
    changePassBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const newPass = document.getElementById('change-new-pass').value.trim();
      changePassStatus.style.display = 'block';

      if (!newPass) {
        changePassStatus.className = 'form-status error';
        changePassStatus.innerText = '❌ பாஸ்வேர்ட் காலியாக உள்ளது!';
        return;
      }

      const config = await getAdminCredentials();
      await setDoc(doc(window.db, "settings", "admin_config"), { ...config, password: newPass });

      changePassStatus.className = 'form-status success';
      changePassStatus.innerText = '🎉 பாஸ்வேர்ட் புதுப்பிக்கப்பட்டது!';
      document.getElementById('change-new-pass').value = '';
    });
  }

  const productForm = document.getElementById('product-form');
  const adminStatus = document.getElementById('admin-status');
  if (productForm && adminStatus) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      adminStatus.className = 'form-status';
      adminStatus.innerText = 'சேமிக்கப்படுகிறது...';
      adminStatus.style.display = 'block';

      const docId = document.getElementById('prod-id').value.trim();
      const name = document.getElementById('prod-name').value.trim();
      const price = parseFloat(document.getElementById('prod-price').value);
      const stock = parseInt(document.getElementById('prod-stock').value, 10);
      const uom = document.getElementById('prod-uom').value.trim();
      const imageUrl = document.getElementById('prod-img').value.trim();

      try {
        await setDoc(doc(window.db, "products", docId), { name, price, stock, uom, imageUrl, image: imageUrl });
        adminStatus.className = 'form-status success';
        adminStatus.innerText = '🎉 பொருள் வெற்றிகரமாக Firebase-ல் சேமிக்கப்பட்டது!';
        productForm.reset();
        loadDashboardData();
        fetchStockFromFirebase();
      } catch (error) {
        console.error(error);
        adminStatus.className = 'form-status error';
        adminStatus.innerText = '❌ சேமிப்பதில் தவறு ஏற்பட்டது!';
      }
    });
  }
}

// Global Export
window.loadDashboardData = loadDashboardData;
