/* ==========================================================================
   Technical Quote Generator
   Phase 1: Foundation shell, navigation, sample dashboard data.
   Phase 2: Customer management (localStorage CRUD, search, validation).
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     Sample / mock dashboard data - clearly labelled. Replaced by a database
     in a later phase.
     ------------------------------------------------------------------------ */
  const sampleStats = {
    totalQuotes: 24,
    draftQuotes: 6,
    acceptedQuotes: 14,
    totalValue: 128400.0
  };

  const sampleRecentQuotes = [
    { number: "Q-2026-024", customer: "Northwind Engineering", status: "accepted", value: 12500.0, date: "28 Aug 2026" },
    { number: "Q-2026-023", customer: "Acme Machinery Inc.", status: "draft", value: 8400.0, date: "27 Aug 2026" },
    { number: "Q-2026-022", customer: "Contoso Fabrication", status: "pending", value: 15990.0, date: "26 Aug 2026" },
    { number: "Q-2026-021", customer: "Globex Industrial", status: "accepted", value: 21350.0, date: "25 Aug 2026" },
    { number: "Q-2026-020", customer: "Initech Systems", status: "rejected", value: 6400.0, date: "22 Aug 2026" }
  ];

  /* ------------------------------------------------------------------------
     Formatters
     ------------------------------------------------------------------------ */
  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });

  const inrFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ------------------------------------------------------------------------
     Settings store (localStorage-backed)
     Central company/branding + quotation defaults used by the builder, preview
     and PDF. Phase 12.
     ------------------------------------------------------------------------ */
  const SETTINGS_KEY = "tqg.settings.v1";

  function defaultSettings() {
    const defaultLogo = (window.TQG_FONTS && window.TQG_FONTS.logo) ? window.TQG_FONTS.logo : "";
    return {
      companyName: "DAIICHI JITSUGYO INDIA PVT. LTD.",
      companyAddress: "",
      companyCity: "",
      companyState: "",
      companyCountry: "",
      companyPhone: "",
      companyEmail: "",
      companyWebsite: "",
      companyGst: "",
      logo: defaultLogo,
      logoName: "logo.png",
      quoteValidity: 30,
      currency: "INR",
      defaultGst: 18,
      paymentTerms: "",
      defaultNotes: "",
      termsConditions: ""
    };
  }

  function readSettings() {
    const d = defaultSettings();
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return Object.assign(d, parsed && typeof parsed === "object" ? parsed : {});
    } catch (err) {
      console.warn("Could not read settings from storage:", err);
      return d;
    }
  }

  function writeSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn("Could not write settings to storage:", err);
    }
  }

  /* ------------------------------------------------------------------------
     Customer store (localStorage-backed)
     Persisted between refreshes. Phase 10 will replace this with Supabase.
     ------------------------------------------------------------------------ */
  const STORAGE_KEY = "tqg.customers.v1";

  function readCustomers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn("Could not read customers from storage:", err);
      return [];
    }
  }

  function writeCustomers(customers) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
    } catch (err) {
      console.warn("Could not write customers to storage:", err);
    }
  }

  function generateId(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  /* ------------------------------------------------------------------------
     Product store (localStorage-backed)
     Persisted between refreshes. Phase 10 will replace this with Supabase.
     ------------------------------------------------------------------------ */
  const PRODUCT_STORAGE_KEY = "tqg.products.v1";

  function readProducts() {
    try {
      const raw = localStorage.getItem(PRODUCT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn("Could not read products from storage:", err);
      return [];
    }
  }

  function writeProducts(products) {
    try {
      localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));
    } catch (err) {
      console.warn("Could not write products to storage:", err);
    }
  }

  /* ------------------------------------------------------------------------
     DOM references
     ------------------------------------------------------------------------ */
  const menuToggle = document.getElementById("menu-toggle");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  const navLinks = Array.prototype.slice.call(
    document.querySelectorAll(".app-nav__link")
  );
  const viewPanels = Array.prototype.slice.call(
    document.querySelectorAll("[data-view-panel]")
  );

  // Customer view elements
  const customerTableBody = document.getElementById("customer-table-body");
  const customerCount = document.getElementById("customer-count");
  const searchInput = document.getElementById("customer-search");
  const emptyAll = document.getElementById("customers-empty-all");
  const emptySearch = document.getElementById("customers-empty-search");

  // Product view elements
  const productTableBody = document.getElementById("product-table-body");
  const productCount = document.getElementById("product-count");
  const productSearch = document.getElementById("product-search");
  const productStatusFilter = document.getElementById("product-status-filter");
  const productCategoryFilter = document.getElementById("product-category-filter");
  const productsEmptyAll = document.getElementById("products-empty-all");
  const productsEmptyFilter = document.getElementById("products-empty-filter");

  // Modals
  const customerModal = document.getElementById("customer-modal");
  const deleteModal = document.getElementById("delete-modal");
  const customerForm = document.getElementById("customer-form");
  const customerModalTitle = document.getElementById("customer-modal-title");
  const customerSubmitBtn = document.getElementById("customer-form-submit");
  const deleteConfirmBtn = document.getElementById("delete-confirm-btn");
  const deleteMessage = document.getElementById("delete-customer-message");
  const toastContainer = document.getElementById("toast-container");

  // Product modals
  const productModal = document.getElementById("product-modal");
  const productDeleteModal = document.getElementById("product-delete-modal");
  const productForm = document.getElementById("product-form");
  const productModalTitle = document.getElementById("product-modal-title");
  const productSubmitBtn = document.getElementById("product-form-submit");
  const productDeleteConfirmBtn = document.getElementById("product-delete-confirm-btn");
  const productDeleteMessage = document.getElementById("product-delete-message");

  /* ------------------------------------------------------------------------
     Sample dashboard data rendering
     ------------------------------------------------------------------------ */
  function renderSampleStats() {
    document.getElementById("stat-total-quotes").textContent = sampleStats.totalQuotes;
    document.getElementById("stat-draft-quotes").textContent = sampleStats.draftQuotes;
    document.getElementById("stat-accepted-quotes").textContent = sampleStats.acceptedQuotes;
    document.getElementById("stat-total-value").textContent =
      currencyFormatter.format(sampleStats.totalValue);
  }

  function renderRecentQuotes() {
    const tbody = document.getElementById("recent-quotes-body");
    const rows = sampleRecentQuotes
      .map(function (q) {
        return (
          "<tr>" +
          "<td>" + q.number + "</td>" +
          "<td>" + q.customer + "</td>" +
          '<td><span class="status status--' + q.status + '">' +
          q.status.charAt(0).toUpperCase() + q.status.slice(1) +
          "</span></td>" +
          "<td>" + currencyFormatter.format(q.value) + "</td>" +
          "<td>" + q.date + "</td>" +
          "</tr>"
        );
      })
      .join("");

    tbody.innerHTML = rows;
  }

  /* ------------------------------------------------------------------------
     Escape HTML in user-provided values
     ------------------------------------------------------------------------ */
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ------------------------------------------------------------------------
     Customer rendering
     ------------------------------------------------------------------------ */
  let customers = readCustomers();
  let currentSearch = "";
  let pendingDeleteId = null;
  let formMode = "add";

  function initialsOf(name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0] ? parts[0].charAt(0) : "";
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase() || "?";
  }

  function renderCustomerTable() {
    const term = currentSearch.trim().toLowerCase();
    const filtered = customers.filter(function (c) {
      if (!term) return true;
      return (
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.company && c.company.toLowerCase().includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.phone && c.phone.toLowerCase().includes(term))
      );
    });

    // Update count
    customerCount.textContent = customers.length + " customer" + (customers.length === 1 ? "" : "s");

    // Toggle empty states
    const hasAny = customers.length > 0;
    const hasMatches = filtered.length > 0;
    emptyAll.classList.toggle("is-hidden", hasAny);
    emptySearch.classList.toggle("is-hidden", hasMatches || !hasAny || !term);

    // Render rows
    customerTableBody.innerHTML = filtered
      .map(function (c) {
        const location = [c.city, c.state, c.country]
          .filter(Boolean)
          .join(", ");
        const avatar = initialsOf(c.name || c.company || "?");
        return (
          "<tr>" +
          "<td>" +
          '<div class="customer-cell">' +
          '<span class="customer-cell__avatar">' + escapeHtml(avatar) + "</span>" +
          '<div>' +
          '<div class="customer-cell__name">' + escapeHtml(c.name) + "</div>" +
          (c.contact
            ? '<div class="customer-cell__sub">' + escapeHtml(c.contact) + "</div>"
            : "") +
          "</div>" +
          "</div>" +
          "</td>" +
          "<td>" + escapeHtml(c.company || "—") + "</td>" +
          "<td>" + (c.email ? '<a href="mailto:' + escapeHtml(c.email) + '">' + escapeHtml(c.email) + "</a>" : "—") + "</td>" +
          "<td>" + escapeHtml(c.phone || "—") + "</td>" +
          "<td>" + escapeHtml(location || "—") + "</td>" +
          "<td>" +
          '<div class="row-actions">' +
          '<button class="icon-btn" type="button" data-action="view" data-id="' + c.id + '" aria-label="View ' + escapeHtml(c.name) + '">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' +
          "</button>" +
          '<button class="icon-btn" type="button" data-action="edit" data-id="' + c.id + '" aria-label="Edit ' + escapeHtml(c.name) + '">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>' +
          "</button>" +
          '<button class="icon-btn icon-btn--danger" type="button" data-action="delete" data-id="' + c.id + '" aria-label="Delete ' + escapeHtml(c.name) + '">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
          "</button>" +
          "</div>" +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  /* ------------------------------------------------------------------------
     Toast notifications
     ------------------------------------------------------------------------ */
  function showToast(message, type) {
    const toast = document.createElement("div");
    toast.className = "toast toast--" + (type || "info");
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      toast.style.transition = "opacity 200ms ease, transform 200ms ease";
      setTimeout(function () {
        toast.remove();
      }, 220);
    }, 3200);
  }

  /* ------------------------------------------------------------------------
     Modal helpers
     ------------------------------------------------------------------------ */
  function openModal(modal) {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    // Focus the first significant field of the opened modal
    if (modal === customerModal) {
      setTimeout(function () {
        document.getElementById("customer-name").focus();
      }, 50);
    } else if (modal === productModal) {
      setTimeout(function () {
        document.getElementById("product-name").focus();
      }, 50);
    }
  }

  function closeModal(modal) {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  document.querySelectorAll("[data-modal-close]").forEach(function (el) {
    el.addEventListener("click", function () {
      closeModal(el.closest(".modal"));
    });
  });

  /* ------------------------------------------------------------------------
     Customer form (add / edit)
     ------------------------------------------------------------------------ */
  function fieldById(id) {
    return document.getElementById(id);
  }

  function setFieldError(field, message) {
    field.classList.add("input-error");
    field.setAttribute("aria-invalid", "true");
    const errorEl = document.getElementById("error-" + field.id);
    if (errorEl) errorEl.textContent = message;
  }

  function clearFieldError(field) {
    field.classList.remove("input-error");
    field.removeAttribute("aria-invalid");
    const errorEl = document.getElementById("error-" + field.id);
    if (errorEl) errorEl.textContent = "";
  }

  function clearAllErrors() {
    ["customer-name", "customer-email"].forEach(function (id) {
      clearFieldError(fieldById(id));
    });
  }

  function resetCustomerForm() {
    customerForm.reset();
    fieldById("customer-id").value = "";
    clearAllErrors();
  }

  function openAddModal() {
    resetCustomerForm();
    formMode = "add";
    customerModalTitle.textContent = "Add Customer";
    customerSubmitBtn.textContent = "Save Customer";
    openModal(customerModal);
  }

  function openEditModal(customer) {
    resetCustomerForm();
    formMode = "edit";
    customerModalTitle.textContent = "Edit Customer";
    customerSubmitBtn.textContent = "Update Customer";

    fieldById("customer-id").value = customer.id;
    fieldById("customer-name").value = customer.name || "";
    fieldById("customer-company").value = customer.company || "";
    fieldById("customer-contact").value = customer.contact || "";
    fieldById("customer-email").value = customer.email || "";
    fieldById("customer-phone").value = customer.phone || "";
    fieldById("customer-address").value = customer.address || "";
    fieldById("customer-city").value = customer.city || "";
    fieldById("customer-state").value = customer.state || "";
    fieldById("customer-country").value = customer.country || "";
    fieldById("customer-notes").value = customer.notes || "";

    openModal(customerModal);
  }

  function validateForm(values) {
    let valid = true;

    // Customer Name is required
    if (!values.name) {
      setFieldError(fieldById("customer-name"), "Customer name is required.");
      valid = false;
    } else {
      clearFieldError(fieldById("customer-name"));
    }

    // Email format (only if provided)
    if (values.email && !emailRegex.test(values.email)) {
      setFieldError(fieldById("customer-email"), "Please enter a valid email address.");
      valid = false;
    } else {
      clearFieldError(fieldById("customer-email"));
    }

    return valid;
  }

  function handleCustomerSubmit(event) {
    event.preventDefault();

    // In view mode, the submit button simply closes the details dialog.
    if (formMode === "view") {
      closeModal(customerModal);
      return;
    }

    const id = fieldById("customer-id").value;
    const values = {
      name: fieldById("customer-name").value.trim(),
      company: fieldById("customer-company").value.trim(),
      contact: fieldById("customer-contact").value.trim(),
      email: fieldById("customer-email").value.trim(),
      phone: fieldById("customer-phone").value.trim(),
      address: fieldById("customer-address").value.trim(),
      city: fieldById("customer-city").value.trim(),
      state: fieldById("customer-state").value.trim(),
      country: fieldById("customer-country").value.trim(),
      notes: fieldById("customer-notes").value.trim()
    };

    if (!validateForm(values)) {
      return;
    }

    if (id) {
      // Edit
      const index = customers.findIndex(function (c) { return c.id === id; });
      if (index !== -1) {
        customers[index] = Object.assign({}, customers[index], values);
        writeCustomers(customers);
        renderCustomerTable();
        closeModal(customerModal);
        showToast('Customer "' + values.name + '" updated.', "success");
      }
    } else {
      // Add
      const customer = Object.assign(values, { id: generateId("cust") });
      customers.push(customer);
      writeCustomers(customers);
      renderCustomerTable();
      closeModal(customerModal);
      showToast('Customer "' + values.name + '" added.', "success");
    }
  }

  customerForm.addEventListener("submit", handleCustomerSubmit);

  // Live validation: clear error as soon as the user fixes the field
  fieldById("customer-name").addEventListener("input", function () {
    if (this.value.trim()) clearFieldError(this);
  });
  fieldById("customer-email").addEventListener("input", function () {
    if (!this.value.trim() || emailRegex.test(this.value.trim())) clearFieldError(this);
  });

  /* ------------------------------------------------------------------------
     Customer details view modal (read-only)
     ------------------------------------------------------------------------ */
  function openViewModal(customer) {
    resetCustomerForm();
    formMode = "view";
    customerModalTitle.textContent = "Customer Details";
    customerSubmitBtn.textContent = "Close";

    fieldById("customer-name").value = customer.name || "";
    fieldById("customer-company").value = customer.company || "";
    fieldById("customer-contact").value = customer.contact || "";
    fieldById("customer-email").value = customer.email || "";
    fieldById("customer-phone").value = customer.phone || "";
    fieldById("customer-address").value = customer.address || "";
    fieldById("customer-city").value = customer.city || "";
    fieldById("customer-state").value = customer.state || "";
    fieldById("customer-country").value = customer.country || "";
    fieldById("customer-notes").value = customer.notes || "";

    // Make fields read-only for the view mode
    const inputs = customerForm.querySelectorAll("input, textarea");
    inputs.forEach(function (input) {
      if (input.id !== "customer-id") input.readOnly = true;
    });

    openModal(customerModal);
    fieldById("customer-name").focus();
  }

  function enableFormEditing() {
    const inputs = customerForm.querySelectorAll("input, textarea");
    inputs.forEach(function (input) {
      input.readOnly = false;
    });
  }

  /* ------------------------------------------------------------------------
     Table action buttons (event delegation)
     ------------------------------------------------------------------------ */
  customerTableBody.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.getAttribute("data-id");
    const action = button.getAttribute("data-action");
    const customer = customers.find(function (c) { return c.id === id; });
    if (!customer) return;

    if (action === "view") {
      enableFormEditing();
      openViewModal(customer);
    } else if (action === "edit") {
      enableFormEditing();
      openEditModal(customer);
    } else if (action === "delete") {
      pendingDeleteId = id;
      deleteMessage.textContent =
        'Are you sure you want to delete "' + customer.name + '"? This action cannot be undone.';
      openModal(deleteModal);
    }
  });

  // Delete confirmation
  deleteConfirmBtn.addEventListener("click", function () {
    if (!pendingDeleteId) return;

    const target = customers.find(function (c) { return c.id === pendingDeleteId; });
    const name = target ? target.name : "Customer";
    customers = customers.filter(function (c) { return c.id !== pendingDeleteId; });
    writeCustomers(customers);
    renderCustomerTable();
    closeModal(deleteModal);
    pendingDeleteId = null;
    showToast('Customer "' + name + '" deleted.', "info");
  });

  // Re-enable editing when opening add/edit directly
  document.getElementById("add-customer-btn").addEventListener("click", function () {
    enableFormEditing();
    openAddModal();
  });
  document.querySelectorAll("[data-empty-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      enableFormEditing();
      openAddModal();
    });
  });

  /* ------------------------------------------------------------------------
     Search
     ------------------------------------------------------------------------ */
  searchInput.addEventListener("input", function () {
    currentSearch = this.value;
    renderCustomerTable();
  });

  /* ------------------------------------------------------------------------
     Products - state & rendering
     ------------------------------------------------------------------------ */
  let products = readProducts();
  let productSearchTerm = "";
  let productStatusValue = "all";
  let productCategoryValue = "all";
  let pendingProductDeleteId = null;
  let productFormMode = "add"; // "add" | "edit" | "view"

  const priceFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function distinctCategories(productsList) {
    const set = {};
    productsList.forEach(function (p) {
      const cat = (p.category || "").trim();
      if (cat) set[cat] = true;
    });
    return Object.keys(set).sort();
  }

  // Rebuild the category <select> options from stored data.
  function renderCategoryFilterOptions() {
    const categories = distinctCategories(products);
    const current = productCategoryValue;
    productCategoryFilter.innerHTML =
      '<option value="all">All Categories</option>' +
      categories
        .map(function (c) {
          return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>";
        })
        .join("");

    // Preserve selection if the chosen category still exists.
    if (categories.indexOf(current) !== -1) {
      productCategoryFilter.value = current;
    } else {
      productCategoryFilter.value = "all";
      productCategoryValue = "all";
    }
  }

  function renderProductTable() {
    renderCategoryFilterOptions();

    const term = productSearchTerm.trim().toLowerCase();
    const filtered = products.filter(function (p) {
      if (productStatusValue !== "all" && p.status !== productStatusValue) return false;
      if (productCategoryValue !== "all" && (p.category || "") !== productCategoryValue) return false;
      if (!term) return true;
      return (
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term))
      );
    });

    productCount.textContent = products.length + " product" + (products.length === 1 ? "" : "s");

    const hasAny = products.length > 0;
    const hasMatches = filtered.length > 0;
    productsEmptyAll.classList.toggle("is-hidden", hasAny);
    productsEmptyFilter.classList.toggle(
      "is-hidden",
      hasMatches || !hasAny || (!term && productStatusValue === "all" && productCategoryValue === "all")
    );

    productTableBody.innerHTML = filtered
      .map(function (p) {
        const statusLabel = p.status === "active" ? "Active" : "Inactive";
        const displayPrice = (p.price == null || p.price === "") ? 0 : p.price;
        const displayGst = (p.gst == null || p.gst === "") ? 0 : p.gst;
        return (
          "<tr>" +
          "<td>" +
          '<div class="product-cell">' +
          '<div class="product-cell__name">' + escapeHtml(p.name) + "</div>" +
          (p.description
            ? '<div class="product-cell__sub">' + escapeHtml(p.description).slice(0, 60) + (p.description.length > 60 ? "…" : "") + "</div>"
            : "") +
          "</div>" +
          "</td>" +
          "<td>" + escapeHtml(p.sku || "—") + "</td>" +
          "<td>" + escapeHtml(p.category || "—") + "</td>" +
          '<td class="table--right">' + priceFormatter.format(Number(displayPrice)) + "</td>" +
          '<td class="table--right">' + Number(displayGst) + "%</td>" +
          '<td><span class="status status--' + p.status + '">' + statusLabel + "</span></td>" +
          "<td>" +
          '<div class="row-actions">' +
          '<button class="icon-btn" type="button" data-product-action="view" data-id="' + p.id + '" aria-label="View ' + escapeHtml(p.name) + '">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' +
          "</button>" +
          '<button class="icon-btn" type="button" data-product-action="edit" data-id="' + p.id + '" aria-label="Edit ' + escapeHtml(p.name) + '">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>' +
          "</button>" +
          '<button class="icon-btn icon-btn--danger" type="button" data-product-action="delete" data-id="' + p.id + '" aria-label="Delete ' + escapeHtml(p.name) + '">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
          "</button>" +
          "</div>" +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  /* ------------------------------------------------------------------------
     Products - form (add / edit / view)
     ------------------------------------------------------------------------ */
  function pfieldById(id) {
    return document.getElementById(id);
  }

  function setProductError(field, message) {
    field.classList.add("input-error");
    field.setAttribute("aria-invalid", "true");
    const errorEl = document.getElementById("error-" + field.id);
    if (errorEl) errorEl.textContent = message;
  }

  function clearProductError(field) {
    field.classList.remove("input-error");
    field.removeAttribute("aria-invalid");
    const errorEl = document.getElementById("error-" + field.id);
    if (errorEl) errorEl.textContent = "";
  }

  function clearAllProductErrors() {
    ["product-name", "product-price", "product-gst", "product-category"].forEach(function (id) {
      clearProductError(pfieldById(id));
    });
  }

  function setProductFieldsReadonly(readonly) {
    productForm.querySelectorAll("input, textarea, select").forEach(function (el) {
      if (el.id !== "product-id") el.readOnly = readonly;
      if (el.disabled !== undefined) el.disabled = false;
    });
  }

  function resetProductForm() {
    productForm.reset();
    pfieldById("product-id").value = "";
    clearAllProductErrors();
  }

  function openProductAddModal() {
    resetProductForm();
    productFormMode = "add";
    setProductFieldsReadonly(false);
    productModalTitle.textContent = "Add Product";
    productSubmitBtn.textContent = "Save Product";
    pfieldById("product-status").value = "active";
    openModal(productModal);
  }

  function openProductEditModal(product) {
    resetProductForm();
    productFormMode = "edit";
    setProductFieldsReadonly(false);
    productModalTitle.textContent = "Edit Product";
    productSubmitBtn.textContent = "Update Product";

    pfieldById("product-id").value = product.id;
    pfieldById("product-name").value = product.name || "";
    pfieldById("product-sku").value = product.sku || "";
    pfieldById("product-category").value = product.category || "";
    pfieldById("product-unit").value = product.unit || "";
    pfieldById("product-price").value = product.price != null ? product.price : "";
    pfieldById("product-gst").value = product.gst != null ? product.gst : "";
    pfieldById("product-status").value = product.status || "active";
    pfieldById("product-description").value = product.description || "";

    openModal(productModal);
  }

  function openProductViewModal(product) {
    resetProductForm();
    productFormMode = "view";
    setProductFieldsReadonly(true);
    productModalTitle.textContent = "Product Details";
    productSubmitBtn.textContent = "Close";

    pfieldById("product-name").value = product.name || "";
    pfieldById("product-sku").value = product.sku || "";
    pfieldById("product-category").value = product.category || "";
    pfieldById("product-unit").value = product.unit || "";
    pfieldById("product-price").value = product.price != null ? product.price : "";
    pfieldById("product-gst").value = product.gst != null ? product.gst : "";
    pfieldById("product-status").value = product.status || "active";
    pfieldById("product-description").value = product.description || "";

    openModal(productModal);
  }

  function validateProductForm(values) {
    let valid = true;

    // Product Name required
    if (!values.name) {
      setProductError(pfieldById("product-name"), "Product name is required.");
      valid = false;
    } else {
      clearProductError(pfieldById("product-name"));
    }

    // Unit Price required and non-negative number
    if (values.price === "" || values.price == null) {
      setProductError(pfieldById("product-price"), "Unit price is required.");
      valid = false;
    } else if (isNaN(values.price) || values.price < 0) {
      setProductError(pfieldById("product-price"), "Enter a valid non-negative price.");
      valid = false;
    } else {
      clearProductError(pfieldById("product-price"));
    }

    // GST non-negative number (optional)
    if (values.gst !== "" && values.gst != null && (isNaN(values.gst) || values.gst < 0)) {
      setProductError(pfieldById("product-gst"), "Enter a valid non-negative tax %.");
      valid = false;
    } else {
      clearProductError(pfieldById("product-gst"));
    }

    return valid;
  }

  function handleProductSubmit(event) {
    event.preventDefault();

    if (productFormMode === "view") {
      closeModal(productModal);
      return;
    }

    const id = pfieldById("product-id").value;
    const rawPrice = pfieldById("product-price").value;
    const rawGst = pfieldById("product-gst").value;
    const values = {
      name: pfieldById("product-name").value.trim(),
      sku: pfieldById("product-sku").value.trim(),
      category: pfieldById("product-category").value.trim(),
      unit: pfieldById("product-unit").value.trim(),
      description: pfieldById("product-description").value.trim(),
      status: pfieldById("product-status").value,
      price: rawPrice === "" ? "" : Number(rawPrice),
      gst: rawGst === "" ? "" : Number(rawGst)
    };

    if (!validateProductForm(values)) {
      return;
    }

    if (id) {
      const index = products.findIndex(function (p) { return p.id === id; });
      if (index !== -1) {
        products[index] = Object.assign({}, products[index], values);
        writeProducts(products);
        renderProductTable();
        closeModal(productModal);
        showToast('Product "' + values.name + '" updated.', "success");
      }
    } else {
      const product = Object.assign(values, { id: generateId("prod") });
      products.push(product);
      writeProducts(products);
      renderProductTable();
      closeModal(productModal);
      showToast('Product "' + values.name + '" added.', "success");
    }
  }

  /* ------------------------------------------------------------------------
     Products - event wiring
     ------------------------------------------------------------------------ */
  productForm.addEventListener("submit", handleProductSubmit);

  // Live clearance of validation errors as the user edits.
  ["product-name", "product-price", "product-gst"].forEach(function (id) {
    pfieldById(id).addEventListener("input", function () {
      clearProductError(this);
    });
  });
  pfieldById("product-category").addEventListener("input", function () {
    clearProductError(this);
  });

  document.getElementById("add-product-btn").addEventListener("click", openProductAddModal);
  document.querySelectorAll("[data-product-empty-add]").forEach(function (btn) {
    btn.addEventListener("click", openProductAddModal);
  });

  // Instant search + filters
  productSearch.addEventListener("input", function () {
    productSearchTerm = this.value;
    renderProductTable();
  });
  productStatusFilter.addEventListener("change", function () {
    productStatusValue = this.value;
    renderProductTable();
  });
  productCategoryFilter.addEventListener("change", function () {
    productCategoryValue = this.value;
    renderProductTable();
  });

  // Table action buttons (event delegation)
  productTableBody.addEventListener("click", function (event) {
    const button = event.target.closest("[data-product-action]");
    if (!button) return;

    const id = button.getAttribute("data-id");
    const action = button.getAttribute("data-product-action");
    const product = products.find(function (p) { return p.id === id; });
    if (!product) return;

    if (action === "view") {
      openProductViewModal(product);
    } else if (action === "edit") {
      openProductEditModal(product);
    } else if (action === "delete") {
      pendingProductDeleteId = id;
      productDeleteMessage.textContent =
        'Are you sure you want to delete "' + product.name + '"? This action cannot be undone.';
      openModal(productDeleteModal);
    }
  });

  // Delete confirmation
  productDeleteConfirmBtn.addEventListener("click", function () {
    if (!pendingProductDeleteId) return;

    const target = products.find(function (p) { return p.id === pendingProductDeleteId; });
    const name = target ? target.name : "Product";
    products = products.filter(function (p) { return p.id !== pendingProductDeleteId; });
    writeProducts(products);
    renderProductTable();
    closeModal(productDeleteModal);
    pendingProductDeleteId = null;
    showToast('Product "' + name + '" deleted.', "info");
  });

  /* ------------------------------------------------------------------------
     Quote (Phase 4) - Create Quote builder & quote store
     Phase 5 - Calculations
     Phase 6 - Quote Preview
     Phase 7 - PDF download / print
     ------------------------------------------------------------------------ */
  const QUOTES_STORAGE_KEY = "tqg.quotes.v1";

  function readQuotes() {
    try {
      const raw = localStorage.getItem(QUOTES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn("Could not read quotes from storage:", err);
      return [];
    }
  }

  function writeQuotes(quotesList) {
    try {
      localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(quotesList));
    } catch (err) {
      console.warn("Could not write quotes to storage:", err);
    }
  }

  let currentQuote = null; // the quote currently being built / previewed
  let editingQuoteId = null; // when set, saving the form updates the quote with this id

  /* ----- Quote number generation (e.g. QT-2026-001) ----- */
  function nextQuoteNumber() {
    const quotes = readQuotes();
    const year = new Date().getFullYear();
    let max = 0;
    quotes.forEach(function (q) {
      const match = /^QT-(\d{4})-(\d+)$/.exec(String(q.number || ""));
      if (match && Number(match[1]) === year) {
        max = Math.max(max, Number(match[2]));
      }
    });
    return "QT-" + year + "-" + String(max + 1).padStart(3, "0");
  }

  /* ----- Phase 5: calculations ----- */
  function num(v) {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  // Mutates each item with computed gross/discount/net/gst/lineTotal and
  // returns the totals summary. Used by the builder, preview and PDF so the
  // values always match.
  function calculateQuote(items) {
    let grossTotal = 0;
    let taxableTotal = 0;
    let totalDiscount = 0;
    let totalGst = 0;
    items.forEach(function (it) {
      const qty = num(it.qty);
      const unitPrice = num(it.unitPrice);
      const discountPer = num(it.discountPer);
      const gstPer = num(it.gstPer);
      const gross = qty * unitPrice;
      const discount = gross * (discountPer / 100);
      const net = gross - discount;
      const gst = net * (gstPer / 100);
      it.gross = gross;
      it.discount = discount;
      it.net = net;
      it.gst = gst;
      it.lineTotal = net + gst;
      grossTotal += gross;
      taxableTotal += net;
      totalDiscount += discount;
      totalGst += gst;
    });
    const grandTotal = taxableTotal + totalGst;
    return {
      subtotal: round2(grossTotal),
      totalTaxable: round2(taxableTotal),
      totalDiscount: round2(totalDiscount),
      totalGst: round2(totalGst),
      grandTotal: round2(grandTotal)
    };
  }

  function round2(v) {
    return Math.round((v + Number.EPSILON) * 100) / 100;
  }

  /* ----- DOM references for the quote builder ----- */
  const quoteForm = document.getElementById("quote-form");
  const quoteCustomerSelect = document.getElementById("quote-customer");
  const quoteSelectedCustomer = document.getElementById("quote-selected-customer");
  const quoteDateInput = document.getElementById("quote-date");
  const quoteValidInput = document.getElementById("quote-valid");
  const quoteLinesEl = document.getElementById("quote-lines");
  const quoteSummary = document.getElementById("quote-summary");
  const addLineBtn = document.getElementById("add-line-btn");

  let quoteLines = []; // working line items for the builder

  function populateQuoteCustomerOptions() {
    customers = readCustomers();
    const current = quoteCustomerSelect.value;
    quoteCustomerSelect.innerHTML =
      '<option value="">Select a customer...</option>' +
      customers
        .map(function (c) {
          const label = (c.company || c.name || "Customer") + (c.company && c.name ? " — " + c.name : "");
          return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(label) + "</option>";
        })
        .join("");
    if (current && customers.some(function (c) { return c.id === current; })) {
      quoteCustomerSelect.value = current;
    }
    updateSelectedCustomerInfo();
  }

  function updateSelectedCustomerInfo() {
    const id = quoteCustomerSelect.value;
    quoteSelectedCustomer.textContent = "";
    const cust = customers.find(function (c) { return c.id === id; });
    if (!cust) return;
    const line1 = [cust.name, cust.company].filter(Boolean).join(", ");
    const line2 = [cust.email, cust.phone, [cust.city, cust.state, cust.country].filter(Boolean).join(", ")]
      .filter(Boolean)
      .join(" · ");
    quoteSelectedCustomer.textContent = line2 ? line1 + " — " + line2 : line1;
  }

  /* ----- Line item row rendering ----- */
  function createLineRow(line) {
    line = line || {};
    const row = document.createElement("div");
    row.className = "quote-line";
    row.dataset.index = quoteLines.length;

    const select = document.createElement("select");
    select.className = "form-select quote-line__product";
    select.setAttribute("aria-label", "Product");
    select.innerHTML =
      '<option value="">Select product...</option>' +
      products
        .filter(function (p) { return p.status === "active"; })
        .map(function (p) {
          return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + " (" + escapeHtml(p.sku || "no SKU") + ")</option>";
        })
        .join("");

    const qty = document.createElement("input");
    qty.type = "number";
    qty.className = "form-input quote-line__qty";
    qty.min = "1";
    qty.step = "1";
    qty.value = line.qty != null ? line.qty : 1;
    qty.setAttribute("aria-label", "Quantity");

    const price = document.createElement("input");
    price.type = "number";
    price.className = "form-input quote-line__price";
    price.min = "0";
    price.step = "0.01";
    price.value = line.unitPrice != null ? line.unitPrice : "";
    price.setAttribute("aria-label", "Unit price");

    const discount = document.createElement("input");
    discount.type = "number";
    discount.className = "form-input quote-line__discount";
    discount.min = "0";
    discount.max = "100";
    discount.step = "0.01";
    discount.value = line.discountPer != null ? line.discountPer : 0;
    discount.setAttribute("aria-label", "Discount %");

    const gst = document.createElement("input");
    gst.type = "number";
    gst.className = "form-input quote-line__gst";
    gst.min = "0";
    gst.step = "0.01";
    gst.value = line.gstPer != null ? line.gstPer : "";
    gst.setAttribute("aria-label", "GST %");

    const total = document.createElement("div");
    total.className = "quote-line__total";
    total.textContent = inrFormatter.format(0);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn icon-btn--danger quote-line__remove";
    remove.setAttribute("aria-label", "Remove line");
    remove.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    row.appendChild(select);
    row.appendChild(qty);
    row.appendChild(price);
    row.appendChild(discount);
    row.appendChild(gst);
    row.appendChild(total);
    row.appendChild(remove);

    // When a product is selected, prefill price + gst from the product
    select.addEventListener("change", function () {
      const p = products.find(function (x) { return x.id === select.value; });
      if (p) {
        price.value = p.price != null ? p.price : "";
        gst.value = p.gst != null ? p.gst : "";
      }
      recomputeQuoteLines();
      updateQuoteSummary();
    });

    [qty, price, discount, gst].forEach(function (input) {
      input.addEventListener("input", function () {
        recomputeQuoteLines();
        updateQuoteSummary();
      });
    });

    remove.addEventListener("click", function () {
      quoteLines.splice(row.dataset.index, 1);
      renderQuoteLines();
      updateQuoteSummary();
    });

    // prefill from product if line already has productId
    if (line.productId) {
      select.value = line.productId;
    }

    return row;
  }

  function renderQuoteLines() {
    quoteLinesEl.innerHTML = "";
    quoteLines.forEach(function (line, index) {
      const row = createLineRow(line);
      row.dataset.index = index;
      quoteLinesEl.appendChild(row);
    });
  }

  // Reads the DOM rows back into quoteLines with fresh values.
  function syncQuoteLinesFromDom() {
    const rows = quoteLinesEl.querySelectorAll(".quote-line");
    quoteLines = [];
    rows.forEach(function (row) {
      quoteLines.push({
        productId: row.querySelector(".quote-line__product").value || "",
        qty: num(row.querySelector(".quote-line__qty").value),
        unitPrice: num(row.querySelector(".quote-line__price").value),
        discountPer: num(row.querySelector(".quote-line__discount").value),
        gstPer: num(row.querySelector(".quote-line__gst").value)
      });
    });
  }

  function recomputeQuoteLines() {
    syncQuoteLinesFromDom();
    const rows = quoteLinesEl.querySelectorAll(".quote-line");
    rows.forEach(function (row) {
      const line = quoteLines[row.dataset.index];
      if (!line) return;
      const qty = num(line.qty);
      const unitPrice = num(line.unitPrice);
      const discountPer = num(line.discountPer);
      const gstPer = num(line.gstPer);
      const gross = qty * unitPrice;
      const discount = gross * (discountPer / 100);
      const net = gross - discount;
      const gst = net * (gstPer / 100);
      row.querySelector(".quote-line__total").textContent =
        inrFormatter.format(net + gst);
    });
  }

  function updateQuoteSummary() {
    syncQuoteLinesFromDom();
    const totals = calculateQuote(quoteLines.map(function (l) {
      return {
        qty: l.qty,
        unitPrice: l.unitPrice,
        discountPer: l.discountPer,
        gstPer: l.gstPer
      };
    }));
    document.getElementById("summary-subtotal").textContent = inrFormatter.format(totals.subtotal);
    document.getElementById("summary-discount").textContent = inrFormatter.format(totals.totalDiscount);
    document.getElementById("summary-gst").textContent = inrFormatter.format(totals.totalGst);
    document.getElementById("summary-grand").textContent = inrFormatter.format(totals.grandTotal);
  }

  addLineBtn.addEventListener("click", function () {
    syncQuoteLinesFromDom();
    quoteLines.push({});
    renderQuoteLines();
    updateQuoteSummary();
    const lastRow = quoteLinesEl.querySelector(".quote-line:last-child");
    if (lastRow) lastRow.querySelector(".quote-line__product").focus();
  });

  quoteCustomerSelect.addEventListener("change", updateSelectedCustomerInfo);

  /* ----- Validation & saving the quote ----- */
  function validateQuoteForm() {
    let valid = true;

    const custId = quoteCustomerSelect.value;
    const custField = quoteCustomerSelect;
    if (!custId) {
      setFieldError(custField, "Please select a customer.");
      valid = false;
    } else {
      clearFieldError(custField);
    }

    syncQuoteLinesFromDom();
    if (!quoteLines.length) {
      document.getElementById("error-quote-lines").textContent = "Add at least one line item.";
      valid = false;
    } else {
      const bad = quoteLines.some(function (l) {
        return !l.productId || l.qty <= 0 || l.unitPrice < 0;
      });
      if (bad) {
        document.getElementById("error-quote-lines").textContent =
          "Each line needs a product and a quantity greater than zero.";
        valid = false;
      } else {
        document.getElementById("error-quote-lines").textContent = "";
      }
    }

    if (!quoteDateInput.value) {
      setFieldError(quoteDateInput, "Quote date is required.");
      valid = false;
    } else {
      clearFieldError(quoteDateInput);
    }

    if (!quoteValidInput.value) {
      setFieldError(quoteValidInput, "Valid until date is required.");
      valid = false;
    } else {
      clearFieldError(quoteValidInput);
    }

    return valid;
  }

  function buildQuoteFromForm() {
    const cust = customers.find(function (c) { return c.id === quoteCustomerSelect.value; }) || {};
    syncQuoteLinesFromDom();

    const items = quoteLines.map(function (l, index) {
      const p = products.find(function (x) { return x.id === l.productId; }) || {};
      const qty = num(l.qty);
      const unitPrice = num(l.unitPrice);
      const discountPer = num(l.discountPer);
      const gstPer = num(l.gstPer);
      return {
        id: "line_" + index,
        productId: l.productId,
        name: p.name || "Item",
        sku: p.sku || "",
        unit: p.unit || "",
        description: p.description || "",
        qty: qty,
        unitPrice: unitPrice,
        discountPer: discountPer,
        gstPer: gstPer
      };
    });

    const totals = calculateQuote(items);

    const quote = {
      id: generateId("quote"),
      number: nextQuoteNumber(),
      status: "draft",
      customerId: cust.id || "",
      customerName: cust.name || "",
      customerCompany: cust.company || "",
      customerContact: cust.contact || "",
      customerEmail: cust.email || "",
      customerPhone: cust.phone || "",
      customerAddress: cust.address || "",
      customerCity: cust.city || "",
      customerState: cust.state || "",
      customerCountry: cust.country || "",
      quoteDate: quoteDateInput.value,
      validUntil: quoteValidInput.value,
      items: items,
      notes: document.getElementById("quote-notes").value.trim(),
      terms: document.getElementById("quote-terms").value.trim(),
      payment: document.getElementById("quote-payment").value.trim(),
      subtotal: totals.subtotal,
      totalTaxable: totals.totalTaxable,
      totalDiscount: totals.totalDiscount,
      totalGst: totals.totalGst,
      grandTotal: totals.grandTotal,
      createdAt: new Date().toISOString()
    };

    return quote;
  }

  quoteForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!validateQuoteForm()) {
      showToast("Please fix the highlighted errors.", "error");
      return;
    }
    const quote = buildQuoteFromForm();
    const quotes = readQuotes();
    const editIdx = editingQuoteId ? quotes.findIndex(function (q) { return q.id === editingQuoteId; }) : -1;
    if (editIdx >= 0) {
      quote.id = editingQuoteId;
      quote.createdAt = quotes[editIdx].createdAt || quote.createdAt;
      quotes[editIdx] = quote;
      writeQuotes(quotes);
      currentQuote = quote;
      renderQuotePreview(quote);
      showView("quote-preview");
      window.location.hash = "#quote-preview";
      editingQuoteId = null;
      showToast('Quote "' + quote.number + '" updated.', "success");
    } else {
      quotes.push(quote);
      writeQuotes(quotes);
      currentQuote = quote;
      renderQuotePreview(quote);
      showView("quote-preview");
      window.location.hash = "#quote-preview";
      showToast('Quote "' + quote.number + '" created.', "success");
    }
    if (typeof renderQuoteHistory === "function") renderQuoteHistory();
  });

  /* ----- Phase 6: Quote preview rendering ----- */
  function formatDate(d) {
    if (!d) return "—";
    const parts = d.split("-");
    if (parts.length !== 3) return d;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function customerBlock(quote) {
    const company = quote.customerCompany || quote.customerName || "—";
    const name = quote.customerCompany && quote.customerName ? quote.customerName : "";
    const lines = [];
    if (company) lines.push("<strong>" + escapeHtml(company) + "</strong>");
    if (name) lines.push(escapeHtml(name));
    if (quote.customerContact) lines.push("Attn: " + escapeHtml(quote.customerContact));
    if (quote.customerEmail) lines.push(escapeHtml(quote.customerEmail));
    if (quote.customerPhone) lines.push(escapeHtml(quote.customerPhone));
    const addressParts = [
      quote.customerAddress,
      [quote.customerCity, quote.customerState, quote.customerCountry].filter(Boolean).join(", ")
    ].filter(Boolean);
    if (addressParts.length) {
      lines.push(escapeHtml(addressParts.join("<br>")));
    }
    return lines.join("<br>") || "—";
  }

  function companyBlock(settings) {
    const lines = [];
    const cityState = [settings.companyCity, settings.companyState, settings.companyCountry].filter(Boolean).join(", ");
    if (settings.companyAddress) lines.push(escapeHtml(settings.companyAddress));
    if (cityState) lines.push(escapeHtml(cityState));
    if (settings.companyPhone) lines.push(escapeHtml(settings.companyPhone));
    if (settings.companyEmail) lines.push(escapeHtml(settings.companyEmail));
    if (settings.companyWebsite) lines.push(escapeHtml(settings.companyWebsite));
    return lines.join("<br>");
  }

  function renderQuotePreview(quote) {
    const settings = readSettings();
    const doc = document.getElementById("quote-doc");
    const empty = document.getElementById("preview-empty");
    if (!quote) {
      doc.classList.add("is-hidden");
      empty.classList.remove("is-hidden");
      return;
    }
    doc.classList.remove("is-hidden");
    empty.classList.add("is-hidden");

    const companyName = settings.companyName || "DAIICHI JITSUGYO INDIA PVT. LTD.";
    const logoData = settings.logo || (window.TQG_FONTS && window.TQG_FONTS.logo) || "";
    const logoImg = logoData
      ? '<img class="qt-doc__logo" src="' + (logoData.indexOf("data:") === 0 ? logoData : "data:image/png;base64," + logoData) + '" alt="' + escapeHtml(companyName) + '">'
      : '<div class="qt-doc__logo qt-doc__logo--fallback">' + escapeHtml((companyName || "C").charAt(0)) + '</div>';
    const companyBlockHtml = companyBlock(settings);

    const notes = quote.notes || settings.defaultNotes || "";
    const payment = quote.payment || settings.paymentTerms || "";
    const terms = quote.terms || settings.termsConditions || "";

    const itemRows = quote.items
      .map(function (it) {
        return (
          "<tr>" +
          "<td class='tbl-description'>" +
          "<div class='qt__item-name'>" + escapeHtml(it.name) + "</div>" +
          (it.description ? "<div class='qt__item-sub'>" + escapeHtml(it.description) + "</div>" : "") +
          (it.sku ? "<div class='qt__item-sub'>SKU: " + escapeHtml(it.sku) + "</div>" : "") +
          "</td>" +
          '<td class="tbl-num">' + num(it.qty) + "</td>" +
          '<td class="tbl-num">' + inrFormatter.format(num(it.unitPrice)) + "</td>" +
          '<td class="tbl-num">' + num(it.discountPer) + "%</td>" +
          '<td class="tbl-num">' + num(it.gstPer) + "%</td>" +
          '<td class="tbl-num">' + inrFormatter.format(num(it.lineTotal)) + "</td>" +
          "</tr>"
        );
      })
      .join("");

    doc.innerHTML =
      '<div class="qt-doc">' +
        '<header class="qt-doc__header">' +
          '<div class="qt-doc__brand">' +
            logoImg +
            '<div class="qt-doc__company">' + escapeHtml(companyName) + '</div>' +
          '</div>' +
          '<div class="qt-doc__title-block">' +
            '<div class="qt-doc__title">QUOTATION</div>' +
            '<div class="qt-doc__meta">Quote #: <strong>' + escapeHtml(quote.number) + '</strong></div>' +
          '</div>' +
        '</header>' +

        '<div class="qt-doc__info">' +
          '<div class="qt-doc__info-date">' +
            '<div class="qt-info-row"><span class="qt-info-dot"></span><span class="qt-info-label">Quote Date</span><span>' + formatDate(quote.quoteDate) + '</span></div>' +
            '<div class="qt-info-row"><span class="qt-info-dot"></span><span class="qt-info-label">Valid Until</span><span>' + formatDate(quote.validUntil) + '</span></div>' +
          '</div>' +
        '</div>' +

        '<section class="qt-doc__parties">' +
          '<div>' +
            '<div class="qt-doc__section-label">FROM</div>' +
            '<div class="qt-doc__party-body"><strong>' + escapeHtml(companyName) + '</strong><br>' + (companyBlockHtml || "") + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="qt-doc__section-label">BILL TO</div>' +
            '<div class="qt-doc__party-body">' + customerBlock(quote) + '</div>' +
          '</div>' +
        '</section>' +

        '<table class="qt-table">' +
          '<thead><tr>' +
            '<th class="tbl-description">Description</th>' +
            '<th class="tbl-num">Qty</th>' +
            '<th class="tbl-num">Unit Price</th>' +
            '<th class="tbl-num">Disc %</th>' +
            '<th class="tbl-num">GST %</th>' +
            '<th class="tbl-num">Amount</th>' +
          '</tr></thead>' +
          '<tbody>' + itemRows + '</tbody>' +
          '<tfoot>' +
            '<tr><td colspan="5" class="tbl-total-label">Subtotal</td><td class="tbl-num">' + inrFormatter.format(quote.subtotal) + '</td></tr>' +
            (quote.totalDiscount > 0 ? '<tr><td colspan="5" class="tbl-total-label">Total Discount</td><td class="tbl-num">− ' + inrFormatter.format(quote.totalDiscount) + '</td></tr>' : '') +
            '<tr><td colspan="5" class="tbl-total-label">Taxable Amount</td><td class="tbl-num">' + inrFormatter.format(quote.totalTaxable != null ? quote.totalTaxable : num(quote.subtotal) - num(quote.totalDiscount)) + '</td></tr>' +
            '<tr><td colspan="5" class="tbl-total-label">Tax (GST)</td><td class="tbl-num">' + inrFormatter.format(quote.totalGst) + '</td></tr>' +
            '<tr class="qt-total-row"><td colspan="5" class="tbl-total-label">Grand Total</td><td class="tbl-num">' + inrFormatter.format(quote.grandTotal) + '</td></tr>' +
          '</tfoot>' +
        '</table>' +

        '<div class="qt-doc__footer-sections">' +
          (notes ? '<div class="qt-note"><div class="qt-doc__section-label">NOTES</div><p>' + escapeHtml(notes).replace(/\n/g, "<br>") + '</p></div>' : '') +
          (payment ? '<div class="qt-note"><div class="qt-doc__section-label">PAYMENT TERMS</div><p>' + escapeHtml(payment).replace(/\n/g, "<br>") + '</p></div>' : '') +
          (terms ? '<div class="qt-note"><div class="qt-doc__section-label">TERMS &amp; CONDITIONS</div><p>' + escapeHtml(terms).replace(/\n/g, "<br>") + '</p></div>' : '') +
        '</div>' +

        '<footer class="qt-doc__footer">' +
          '<span>' + escapeHtml(companyName) + '</span>' +
          '<span>' + escapeHtml(quote.number) + '</span>' +
        '</footer>' +
      '</div>';
  }

  /* ----- Phase 6/7: Preview navigation ----- */
  document.getElementById("preview-back-btn").addEventListener("click", function () {
    showView("create-quote");
    window.location.hash = "#create-quote";
  });

  document.getElementById("preview-to-create-btn").addEventListener("click", function () {
    showView("create-quote");
    window.location.hash = "#create-quote";
  });

  document.getElementById("print-quote-btn").addEventListener("click", function () {
    if (!currentQuote) {
      showToast("Create a quote before printing.", "error");
      return;
    }
    renderQuotePreview(currentQuote);
    window.print();
  });

  /* ----- Phase 7: PDF download ----- */
  document.getElementById("download-pdf-btn").addEventListener("click", function () {
    if (!currentQuote) {
      showToast("Create a quote before downloading a PDF.", "error");
      return;
    }
    if (typeof window.jspdf === "undefined" || typeof window.jspdf.jsPDF !== "function") {
      showToast("PDF library not loaded. Check your internet connection and retry.", "error");
      return;
    }
    downloadPdf(currentQuote);
  });

  function downloadPdf(quote) {
    const settings = readSettings();
    const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true });

    // jsPDF's built-in helvetica cannot encode the Indian Rupee symbol (U+20B9).
    // Passing a currency string containing it mangles the whole string (null bytes
    // between every digit). Use an embedded Noto Sans subset that includes the glyph.
    var FONT_FAMILY = "NotoSans";
    if (window.TQG_FONTS) {
      try {
        doc.addFileToVFS("NotoSans.ttf", window.TQG_FONTS.regular);
        doc.addFont("NotoSans.ttf", FONT_FAMILY, "normal");
        doc.addFileToVFS("NotoSans-Bold.ttf", window.TQG_FONTS.bold);
        doc.addFont("NotoSans-Bold.ttf", FONT_FAMILY, "bold");
        doc.setFont(FONT_FAMILY, "normal");
      } catch (e) {
        console.warn("Could not load embedded font; falling back to helvetica.", e);
        FONT_FAMILY = "helvetica";
      }
    } else {
      FONT_FAMILY = "helvetica";
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const accent = [79, 140, 255];
    const dark = [35, 40, 49];
    const muted = [110, 116, 128];
    const light = [246, 248, 251];

    let cursorY = margin;

    // --- Header: logo (top-left), company name next to it, QUOTATION (top-right) ---
    var COMPANY_NAME = settings.companyName || "DAIICHI JITSUGYO INDIA PVT. LTD.";
    var headerTop = margin;
    var headerLeft = margin;
    var logoH = 12;
    var logoW = logoH * (512 / 272); // keep source aspect ratio, never stretch

    // Logo sits on the white page so the blue brand mark stays clearly visible
    // (a blue logo on the dark band would be near-invisible).
    var pdfLogo = settings.logo || (window.TQG_FONTS && window.TQG_FONTS.logo) || "";
    if (pdfLogo) {
      try {
        doc.addImage(pdfLogo, "PNG", headerLeft, headerTop, logoW, logoH);
      } catch (e) {
        console.warn("Could not embed company logo in PDF.", e);
      }
    }

    // Company name vertically centred against the logo.
    var nameX = headerLeft + logoW + 6;
    var nameCenterY = headerTop + logoH / 2;
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFont(FONT_FAMILY, "bold");
    doc.setFontSize(12.5);
    doc.text(COMPANY_NAME, nameX, nameCenterY + 1.8);

    // QUOTATION top-right with the quote number below it.
    var rightX = pageWidth - margin - 2;
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.setFont(FONT_FAMILY, "bold");
    doc.setFontSize(14);
    doc.text("QUOTATION", rightX, headerTop + 5, { align: "right" });
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(quote.number, rightX, headerTop + 11.5, { align: "right" });

    // Blue accent strip below the header row (keeps the existing accent styling).
    var bandTop = headerTop + logoH + 6;
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(headerLeft, bandTop, pageWidth - margin * 2, 2.2, "F");

    cursorY = bandTop + 2.2 + 10;

    // Info + bill to
    doc.setTextColor(dark[0], dark[1], dark[2]);

    function infoBlock(label, value, x, y) {
      doc.setFillColor(light[0], light[1], light[2]);
      doc.roundedRect(x, y, 84, 14, 2, 2, "F");
      doc.setFont(FONT_FAMILY, "bold");
      doc.setFontSize(7);
      doc.setTextColor(accent[0], accent[1], accent[2]);
      doc.text(label, x + 4, y + 5.5);
      doc.setFont(FONT_FAMILY, "normal");
      doc.setFontSize(9);
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.text(String(value), x + 4, y + 10.5);
    }

    infoBlock("QUOTE DATE", formatDate(quote.quoteDate), margin, cursorY);
    infoBlock("VALID UNTIL", formatDate(quote.validUntil), margin + 92, cursorY);

    cursorY += 22;

    // From (company)
    doc.setFont(FONT_FAMILY, "bold");
    doc.setFontSize(8);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text("FROM", margin, cursorY);
    doc.setDrawColor(220, 224, 230);
    doc.line(margin, cursorY + 2, pageWidth - margin, cursorY + 2);
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(10);
    doc.setTextColor(dark[0], dark[1], dark[2]);

    let fromY = cursorY + 8;
    doc.setFont(FONT_FAMILY, "bold");
    doc.text(COMPANY_NAME, margin, fromY);
    fromY += 6;
    doc.setFont(FONT_FAMILY, "normal");
    const fromLines = [
      settings.companyAddress,
      [settings.companyCity, settings.companyState, settings.companyCountry].filter(Boolean).join(", "),
      settings.companyPhone,
      settings.companyEmail,
      settings.companyWebsite
    ].filter(Boolean);
    fromLines.forEach(function (a) { doc.text(a, margin, fromY); fromY += 6; });
    cursorY = fromY + 8;

    // Bill to
    doc.setFont(FONT_FAMILY, "bold");
    doc.setFontSize(8);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text("BILL TO", margin, cursorY);
    doc.setDrawColor(220, 224, 230);
    doc.line(margin, cursorY + 2, pageWidth - margin, cursorY + 2);
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(10);
    doc.setTextColor(dark[0], dark[1], dark[2]);

    let billY = cursorY + 8;
    const company = quote.customerCompany || quote.customerName || "—";
    doc.setFont(FONT_FAMILY, "bold");
    doc.text(company, margin, billY);
    billY += 6;
    doc.setFont(FONT_FAMILY, "normal");
    if (quote.customerCompany && quote.customerName) {
      doc.text(quote.customerName, margin, billY);
      billY += 6;
    }
    if (quote.customerContact) { doc.text("Attn: " + quote.customerContact, margin, billY); billY += 6; }
    if (quote.customerEmail) { doc.text(quote.customerEmail, margin, billY); billY += 6; }
    if (quote.customerPhone) { doc.text(quote.customerPhone, margin, billY); billY += 6; }
    const addressParts = [];
    if (quote.customerAddress) addressParts.push(quote.customerAddress);
    const cityState = [quote.customerCity, quote.customerState, quote.customerCountry].filter(Boolean).join(", ");
    if (cityState) addressParts.push(cityState);
    addressParts.forEach(function (a) { doc.text(a, margin, billY); billY += 6; });

    cursorY = billY + 8;

    // Items table with automatic page-break handling
    const bodyRows = quote.items.map(function (it) {
      return [
        (it.name || "Item") + (it.description ? "\n" + it.description : ""),
        String(num(it.qty)),
        inrFormatter.format(num(it.unitPrice)),
        num(it.discountPer) + "%",
        num(it.gstPer) + "%",
        inrFormatter.format(num(it.lineTotal))
      ];
    });

    const footerRows = [];
    footerRows.push(["", "", "", "", "Subtotal", inrFormatter.format(quote.subtotal), { styles: { halign: "right", fontStyle: "normal" } }]);
    if (quote.totalDiscount > 0) {
      footerRows.push(["", "", "", "", "Total Discount", "- " + inrFormatter.format(quote.totalDiscount), { styles: { halign: "right" } }]);
    }
    footerRows.push(["", "", "", "", "Taxable Amount", inrFormatter.format(quote.totalTaxable != null ? quote.totalTaxable : num(quote.subtotal) - num(quote.totalDiscount)), { styles: { halign: "right" } }]);
    footerRows.push(["", "", "", "", "Tax (GST)", inrFormatter.format(quote.totalGst), { styles: { halign: "right" } }]);
    footerRows.push(["", "", "", "", "Grand Total", inrFormatter.format(quote.grandTotal), { styles: { halign: "right", fontStyle: "bold" } }]);

    doc.autoTable({
      startY: cursorY,
      margin: { left: margin, right: margin, top: 30, bottom: 22 },
      head: [["Description", "Qty", "Unit Price", "Disc %", "GST %", "Amount"]],
      body: bodyRows,
      foot: footerRows,
      theme: "grid",
      styles: { font: FONT_FAMILY, fontStyle: "normal", fontSize: 9, cellPadding: 2.5, textColor: dark, lineColor: [222, 226, 231], lineWidth: 0.3, valign: "middle" },
      headStyles: { font: FONT_FAMILY, fontStyle: "bold", fillColor: accent, textColor: 255, halign: "left", valign: "middle" },
      footStyles: { font: FONT_FAMILY, fontStyle: "bold", fillColor: light, textColor: dark, halign: "right", valign: "middle" },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { halign: "right", cellWidth: 16 },
        2: { halign: "right", cellWidth: 32 },
        3: { halign: "right", cellWidth: 20 },
        4: { halign: "right", cellWidth: 20 },
        5: { halign: "right", cellWidth: 38 }
      },
      didParseCell: function (data) {
        if (data.section === "foot" && data.column.index === 5 && data.row.index === footerRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = accent;
          data.cell.styles.textColor = [255, 255, 255];
        }
      },
      pageBreak: "auto",
      didDrawPage: function (data) {
        // Page footer with page numbers
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFont(FONT_FAMILY, "normal");
        doc.setFontSize(8);
        doc.setTextColor(muted[0], muted[1], muted[2]);
        const footerText = COMPANY_NAME + " — " + quote.number;
        doc.text(footerText, margin, pageHeight - 10);
        doc.text("Page " + doc.internal.getCurrentPageInfo().pageNumber + " of " + pageCount, pageWidth - margin, pageHeight - 10, { align: "right" });
      }
    });

    const afterTable = doc.lastAutoTable ? doc.lastAutoTable.finalY : cursorY;

    // Notes / terms
    let noteY = afterTable + 10;
    const notes = [];
    if (quote.payment || settings.paymentTerms) notes.push(["PAYMENT TERMS", quote.payment || settings.paymentTerms]);
    if (quote.terms || settings.termsConditions) notes.push(["TERMS & CONDITIONS", quote.terms || settings.termsConditions]);
    if (quote.notes || settings.defaultNotes) notes.push(["NOTES", quote.notes || settings.defaultNotes]);

    if (notes.length) {
      if (noteY > pageHeight - 50) {
        doc.addPage();
        noteY = margin + 10;
      }
      notes.forEach(function (n) {
        doc.setFont(FONT_FAMILY, "bold");
        doc.setFontSize(8);
        doc.setTextColor(accent[0], accent[1], accent[2]);
        doc.text(n[0], margin, noteY);
        noteY += 4;
        doc.setFont(FONT_FAMILY, "normal");
        doc.setFontSize(9);
        doc.setTextColor(dark[0], dark[1], dark[2]);
        const lines = doc.splitTextToSize(n[1], pageWidth - margin * 2);
        lines.forEach(function (line) {
          if (noteY > pageHeight - 15) {
            doc.addPage();
            noteY = margin + 8;
          }
          doc.text(line, margin, noteY);
          noteY += 5;
        });
        noteY += 5;
      });
    }

    doc.save("Quotation-" + quote.number + ".pdf");
  }

  /* ------------------------------------------------------------------------
     Show preview with last saved quote when navigating to preview view
     ------------------------------------------------------------------------ */
  document.querySelectorAll('.app-nav__link[data-view="quote-preview"]').forEach(function (link) {
    link.addEventListener("click", function () {
      if (currentQuote) renderQuotePreview(currentQuote);
      else { renderQuotePreview(null); }
    });
  });

  function showView(viewName) {
    viewPanels.forEach(function (panel) {
      const isMatch = panel.id === "view-" + viewName;
      panel.classList.toggle("is-hidden", !isMatch);
    });

    navLinks.forEach(function (link) {
      const isActive = link.getAttribute("data-view") === viewName;
      link.closest(".app-nav__item").classList.toggle("is-active", isActive);
    });

    if (viewName === "quote-history") renderQuoteHistory();
    if (viewName === "settings") renderSettings();
  }

  navLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      const viewName = link.getAttribute("data-view");
      if (viewName) {
        showView(viewName);
        closeMobileMenu();
      }
    });
  });

  const createTrigger = document.querySelector("[data-view-trigger-create]");
  if (createTrigger) {
    createTrigger.addEventListener("click", function () {
      populateQuoteCustomerOptions();
      showView("create-quote");
      window.location.hash = "#create-quote";
    });
  }

  document.querySelectorAll('.app-nav__link[data-view="create-quote"]').forEach(function (link) {
    link.addEventListener("click", function () {
      populateQuoteCustomerOptions();
    });
  });

  /* ------------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------------ */
  function openMobileMenu() {
    document.body.classList.add("sidebar-open");
    menuToggle.setAttribute("aria-expanded", "true");
  }

  function closeMobileMenu() {
    document.body.classList.remove("sidebar-open");
    menuToggle.setAttribute("aria-expanded", "false");
  }

  menuToggle.addEventListener("click", function () {
    const isOpen = document.body.classList.contains("sidebar-open");
    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  sidebarBackdrop.addEventListener("click", closeMobileMenu);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
      closeMobileMenu();
      return;
    }
    if (event.key === "Escape") {
      const openModals = document.querySelectorAll(".modal.is-open");
      openModals.forEach(function (modal) {
        closeModal(modal);
      });
      pendingDeleteId = null;
      pendingProductDeleteId = null;
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 768) {
      closeMobileMenu();
    }
  });

  /* ------------------------------------------------------------------------
     Phase 12: Settings
     ------------------------------------------------------------------------ */
  function statusBadge(status) {
    const s = status || "draft";
    return '<span class="status-badge status-badge--' + s + '">' + escapeHtml(s.charAt(0).toUpperCase() + s.slice(1)) + '</span>';
  }

  function renderSettings() {
    const s = readSettings();
    setField("set-company-name", s.companyName);
    setField("set-company-address", s.companyAddress);
    setField("set-company-city", s.companyCity);
    setField("set-company-state", s.companyState);
    setField("set-company-country", s.companyCountry);
    setField("set-company-phone", s.companyPhone);
    setField("set-company-email", s.companyEmail);
    setField("set-company-website", s.companyWebsite);
    setField("set-company-gst", s.companyGst);
    setField("set-quote-validity", s.quoteValidity);
    setField("set-currency", s.currency);
    setField("set-default-gst", s.defaultGst);
    setField("set-payment-terms", s.paymentTerms);
    setField("set-default-notes", s.defaultNotes);
    setField("set-terms-conditions", s.termsConditions);
    renderSettingsLogo(s.logo);
    setSettingsFeedback("", "");
  }

  function setField(id, value) {
    const el = document.getElementById(id);
    if (el) {
      if (el.value !== String(value == null ? "" : value)) {
        el.value = value == null ? "" : value;
      }
    }
  }

  function renderSettingsLogo(data) {
    const img = document.getElementById("set-logo-preview");
    if (!img) return;
    if (data) {
      img.src = data.indexOf("data:") === 0 ? data : "data:image/png;base64," + data;
      img.classList.add("has-logo");
      img.title = "Company logo";
    } else {
      img.removeAttribute("src");
      img.classList.remove("has-logo");
      img.removeAttribute("title");
    }
  }

  function setSettingsFeedback(message, type) {
    const el = document.getElementById("settings-feedback");
    if (!el) return;
    el.textContent = message || "";
    el.className = "settings-feedback" + (type === "error" ? " is-error" : type === "success" ? " is-success" : "");
  }

  function collectSettingsFromForm() {
    return {
      companyName: document.getElementById("set-company-name").value.trim(),
      companyAddress: document.getElementById("set-company-address").value.trim(),
      companyCity: document.getElementById("set-company-city").value.trim(),
      companyState: document.getElementById("set-company-state").value.trim(),
      companyCountry: document.getElementById("set-company-country").value.trim(),
      companyPhone: document.getElementById("set-company-phone").value.trim(),
      companyEmail: document.getElementById("set-company-email").value.trim(),
      companyWebsite: document.getElementById("set-company-website").value.trim(),
      companyGst: document.getElementById("set-company-gst").value.trim(),
      quoteValidity: num(document.getElementById("set-quote-validity").value) || 30,
      currency: document.getElementById("set-currency").value || "INR",
      defaultGst: num(document.getElementById("set-default-gst").value) || 0,
      paymentTerms: document.getElementById("set-payment-terms").value.trim(),
      defaultNotes: document.getElementById("set-default-notes").value.trim(),
      termsConditions: document.getElementById("set-terms-conditions").value.trim(),
      logo: currentSettingsLogo,
      logoName: currentSettingsLogoName
    };
  }

  let currentSettingsLogo = null;
  let currentSettingsLogoName = "";

  function saveSettingsFromForm() {
    const name = document.getElementById("set-company-name").value.trim();
    if (!name) {
      setSettingsFeedback("Company Name is required.", "error");
      return;
    }
    writeSettings(collectSettingsFromForm());
    setSettingsFeedback("Settings saved.", "success");
    showToast("Settings saved.", "success");
    if (currentQuote) renderQuotePreview(currentQuote);
  }

  function resetSettingsToDefaults() {
    const d = defaultSettings();
    giveSettingsLogo(d.logo);
    writeSettings(d);
    renderSettings();
    setSettingsFeedback("Settings reset to defaults.", "success");
    showToast("Settings reset to defaults.", "success");
  }

  function giveSettingsLogo(data) {
    currentSettingsLogo = data || "";
    currentSettingsLogoName = data ? (currentSettingsLogoName || "logo.png") : "";
    renderSettingsLogo(currentSettingsLogo);
  }

  function handleSettingsLogoFile(file) {
    const errEl = document.getElementById("error-settings-logo");
    if (errEl) errEl.textContent = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      if (errEl) errEl.textContent = "Please choose an image file (PNG, JPG, etc.).";
      return;
    }
    const reader = new FileReader();
    reader.onload = function (event) {
      giveSettingsLogo(event.target.result);
      currentSettingsLogoName = file.name;
    };
    reader.onerror = function () {
      if (errEl) errEl.textContent = "Could not read the selected file.";
    };
    reader.readAsDataURL(file);
  }

  function wireSettingsEvents() {
    var saveBtn = document.getElementById("settings-save-btn");
    var resetBtn = document.getElementById("settings-reset-btn");
    var logoInput = document.getElementById("set-logo-input");
    var logoRemove = document.getElementById("set-logo-remove");
    if (saveBtn) saveBtn.addEventListener("click", saveSettingsFromForm);
    if (resetBtn) resetBtn.addEventListener("click", resetSettingsToDefaults);
    if (logoInput) logoInput.addEventListener("change", function (event) {
      handleSettingsLogoFile(event.target.files && event.target.files[0]);
      event.target.value = "";
    });
    if (logoRemove) logoRemove.addEventListener("click", function () {
      giveSettingsLogo("");
      setSettingsFeedback("Logo removed. Save to keep this change.", "success");
    });
  }

  /* ------------------------------------------------------------------------
     Phase 8: Quote History
     ------------------------------------------------------------------------ */
  var historyState = { query: "", status: "", sort: "date-desc" };

  function historyVisibleQuotes() {
    var quotes = readQuotes().slice();
    var q = historyState.query.trim().toLowerCase();
    if (q) {
      quotes = quotes.filter(function (quote) {
        var hay = [quote.number, quote.customerName, quote.customerCompany].filter(Boolean).join(" ").toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    }
    if (historyState.status) {
      quotes = quotes.filter(function (quote) { return (quote.status || "draft") === historyState.status; });
    }
    var sort = historyState.sort || "date-desc";
    quotes.sort(function (a, b) {
      switch (sort) {
        case "date-asc": return (a.quoteDate || "").localeCompare(b.quoteDate || "");
        case "date-desc": return (b.quoteDate || "").localeCompare(a.quoteDate || "");
        case "number-asc": return (a.number || "").localeCompare(b.number || "");
        case "number-desc": return (b.number || "").localeCompare(a.number || "");
        case "customer-asc": return (a.customerCompany || a.customerName || "").localeCompare(b.customerCompany || b.customerName || "");
        case "customer-desc": return (b.customerCompany || b.customerName || "").localeCompare(a.customerCompany || a.customerName || "");
        case "amount-asc": return num(a.grandTotal) - num(b.grandTotal);
        case "amount-desc": return num(b.grandTotal) - num(a.grandTotal);
        case "status": return (a.status || "draft").localeCompare(b.status || "draft");
        default: return (b.quoteDate || "").localeCompare(a.quoteDate || "");
      }
    });
    return quotes;
  }

  function renderQuoteHistory() {
    var tbody = document.getElementById("history-tbody");
    var empty = document.getElementById("history-empty");
    var table = document.getElementById("history-table");
    if (!tbody || !empty || !table) return;
    var quotes = historyVisibleQuotes();

    if (!quotes.length) {
      tbody.innerHTML = "";
      table.classList.add("is-hidden");
      empty.classList.remove("is-hidden");
      var noMatch = !!historyState.query || !!historyState.status;
      document.getElementById("history-empty-title").textContent = noMatch ? "No matching quotes" : "No quotes yet";
      const emptyText = document.querySelector("#history-empty .empty-state__text");
      if (emptyText) {
        emptyText.textContent = noMatch
          ? "Try adjusting your search or status filter."
          : "Create your first quote to see it here.";
      }
      return;
    }

    table.classList.remove("is-hidden");
    empty.classList.add("is-hidden");
    tbody.innerHTML = quotes.map(function (quote) {
      var status = quote.status || "draft";
      var main = escapeHtml(quote.customerCompany || quote.customerName || "—");
      var sub = quote.customerCompany ? (quote.customerName || "") : "";
      return (
        "<tr data-quote-id='" + quote.id + "'>" +
          '<td class="table--right"><button class="link-btn" type="button" data-action="view">' + escapeHtml(quote.number) + '</button></td>' +
          "<td>" + main + (sub ? "<div class='table-sub'>" + escapeHtml(sub) + "</div>" : "") + "</td>" +
          '<td class="table--right">' + formatDate(quote.quoteDate) + "</td>" +
          '<td class="table--right">' + formatDate(quote.validUntil) + "</td>" +
          '<td class="table--right table--amount">' + inrFormatter.format(num(quote.grandTotal)) + "</td>" +
          '<td class="status-cell">' +
            '<select class="history-status form-select" aria-label="Change status">' +
              ["draft", "sent", "pending", "accepted", "rejected", "expired"].map(function (s) {
                return "<option value='" + s + "'" + (s === status ? " selected" : "") + ">" + s.charAt(0).toUpperCase() + s.slice(1) + "</option>";
              }).join("") +
            "</select>" +
          "</td>" +
          '<td class="table--right">' +
            '<div class="table-actions">' +
              '<button class="btn btn--tiny" type="button" data-action="view">View</button>' +
              '<button class="btn btn--tiny" type="button" data-action="edit">Edit</button>' +
              '<button class="btn btn--tiny" type="button" data-action="duplicate">Duplicate</button>' +
              '<button class="btn btn--tiny" type="button" data-action="pdf">PDF</button>' +
              '<button class="btn btn--tiny btn--danger" type="button" data-action="delete">Delete</button>' +
            "</div>" +
          "</td>" +
        "</tr>"
      );
    }).join("");
  }

  function loadQuoteIntoBuilder(quote, asEdit) {
    editingQuoteId = asEdit ? quote.id : null;
    populateQuoteCustomerOptions();
    if (quoteCustomerSelect) quoteCustomerSelect.value = quote.customerId || "";
    if (quoteDateInput) quoteDateInput.value = quote.quoteDate || new Date().toISOString().slice(0, 10);
    if (quoteValidInput) quoteValidInput.value = quote.validUntil || "";
    document.getElementById("quote-notes").value = quote.notes || "";
    document.getElementById("quote-terms").value = quote.terms || "";
    document.getElementById("quote-payment").value = quote.payment || "";
    quoteLines = (quote.items || []).map(function (it) {
      return {
        productId: it.productId || "",
        qty: it.qty != null ? it.qty : 0,
        unitPrice: it.unitPrice != null ? it.unitPrice : 0,
        discountPer: it.discountPer != null ? it.discountPer : 0,
        gstPer: it.gstPer != null ? it.gstPer : 0
      };
    });
    if (!quoteLines.length) quoteLines.push({});
    renderQuoteLines();
    updateQuoteSummary();
  }

  function openHistoryQuote(action, id) {
    var quotes = readQuotes();
    var quote = quotes.find(function (q) { return q.id === id; });
    if (!quote) {
      showToast("Quote not found.", "error");
      return;
    }
    if (action === "view") {
      currentQuote = quote;
      renderQuotePreview(quote);
      showView("quote-preview");
      window.location.hash = "#quote-preview";
    } else if (action === "edit") {
      loadQuoteIntoBuilder(quote, true);
      showView("create-quote");
      window.location.hash = "#create-quote";
      showToast('Editing quote "' + quote.number + '".', "info");
    } else if (action === "duplicate") {
      loadQuoteIntoBuilder(quote, false);
      showView("create-quote");
      window.location.hash = "#create-quote";
      showToast('Duplicating quote "' + quote.number + '" as a new quote.', "info");
    } else if (action === "pdf") {
      downloadPdf(quote);
    } else if (action === "delete") {
      if (window.confirm('Delete quote "' + quote.number + '" permanently?')) {
        var remaining = quotes.filter(function (q) { return q.id !== id; });
        writeQuotes(remaining);
        renderQuoteHistory();
        if (currentQuote && currentQuote.id === id) {
          currentQuote = null;
        }
        showToast('Quote "' + quote.number + '" deleted.', "success");
      }
    }
  }

  function wireHistoryEvents() {
    var search = document.getElementById("history-search");
    if (search) {
      search.addEventListener("input", function () {
        historyState.query = search.value;
        renderQuoteHistory();
      });
    }
    var statusFilter = document.getElementById("history-status");
    if (statusFilter) {
      statusFilter.addEventListener("change", function () {
        historyState.status = statusFilter.value;
        renderQuoteHistory();
      });
    }
    var sort = document.getElementById("history-sort");
    if (sort) {
      sort.addEventListener("change", function () {
        historyState.sort = sort.value;
        renderQuoteHistory();
      });
    }
    var tbody = document.getElementById("history-tbody");
    if (tbody) {
      tbody.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-action]");
        if (!btn) return;
        var row = btn.closest("tr[data-quote-id]");
        if (!row) return;
        openHistoryQuote(btn.getAttribute("data-action"), row.getAttribute("data-quote-id"));
      });
      tbody.addEventListener("change", function (event) {
        if (event.target.classList.contains("history-status")) {
          var row = event.target.closest("tr[data-quote-id]");
          if (!row) return;
          var quotes = readQuotes();
          var quote = quotes.find(function (q) { return q.id === row.getAttribute("data-quote-id"); });
          if (quote) {
            quote.status = event.target.value;
            quote.statusChangedAt = new Date().toISOString();
            writeQuotes(quotes);
            renderQuoteHistory();
            showToast('Status set to "' + quote.status + '".', "success");
          }
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
     Deep-link support
     ------------------------------------------------------------------------ */
  function syncViewWithHash() {
    const hash = window.location.hash.replace("#", "");
    const viewName = hash.replace("view-", "");
    const target = document.getElementById("view-" + viewName);
    if (target) {
      showView(viewName);
    }
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  function prepareInitialQuoteForm() {
    const settings = readSettings();
    populateQuoteCustomerOptions();
    if (!quoteDateInput.value) {
      quoteDateInput.value = new Date().toISOString().slice(0, 10);
    }
    if (!quoteValidInput.value) {
      const d = new Date();
      d.setDate(d.getDate() + (Number(settings.quoteValidity) || 30));
      quoteValidInput.value = d.toISOString().slice(0, 10);
    }
    if (!quoteLines.length) {
      syncQuoteLinesFromDom();
      if (!quoteLines.length) {
        quoteLines.push({ gstPer: settings.defaultGst || 0 });
        renderQuoteLines();
      }
    }
    if (!document.getElementById("quote-notes").value) {
      document.getElementById("quote-notes").value = settings.defaultNotes || "";
    }
    if (!document.getElementById("quote-terms").value) {
      document.getElementById("quote-terms").value = settings.termsConditions || "";
    }
    if (!document.getElementById("quote-payment").value) {
      document.getElementById("quote-payment").value = settings.paymentTerms || "";
    }
    updateQuoteSummary();
  }

  function init() {
    renderSampleStats();
    renderRecentQuotes();
    renderCustomerTable();
    renderProductTable();
    populateQuoteCustomerOptions();
    prepareInitialQuoteForm();
    giveSettingsLogo(readSettings().logo);
    wireSettingsEvents();
    renderSettings();
    wireHistoryEvents();
    renderQuoteHistory();
    if (currentQuote) renderQuotePreview(currentQuote);
    else renderQuotePreview(null);
    syncViewWithHash();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
