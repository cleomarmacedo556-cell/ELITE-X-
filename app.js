/*
  ELITE X — camada de apresentação.
  Os métodos abaixo usam APIs REST preparadas para um backend futuro.
  Nenhuma credencial de pagamento deve ficar neste arquivo.
*/

const CONFIG = {
  API_BASE_URL: "", // Ex.: "https://api.seudominio.com"
  API_VERSION: "/api",
  USE_MOCK_DATA: false
};

const mockCreators = [
  { id:"creator_001", name:"Aurora", initials:"A", verified:true, category:"Lifestyle", subscribers:12400 },
  { id:"creator_002", name:"Nina", initials:"N", verified:true, category:"Premium", subscribers:8900 },
  { id:"creator_003", name:"Maya", initials:"M", verified:true, category:"Vídeos", subscribers:15700 },
  { id:"creator_004", name:"Luna", initials:"L", verified:true, category:"Fotos", subscribers:6300 }
];

const mockContent = [
  { id:"content_001", creatorId:"creator_001", title:"Coleção Aurora", type:"Fotos", price:"R$ 19,90", preview:"Prévia 01", locked:true },
  { id:"content_002", creatorId:"creator_002", title:"Private Session", type:"Vídeo", price:"R$ 24,90", preview:"Prévia 02", locked:true },
  { id:"content_003", creatorId:"creator_003", title:"After Dark", type:"Vídeo", price:"R$ 29,90", preview:"Prévia 03", locked:true },
  { id:"content_004", creatorId:"creator_004", title:"Luna Premium", type:"Fotos", price:"R$ 17,90", preview:"Prévia 04", locked:true }
];

const $ = (selector) => document.querySelector(selector);

function formatBRL(value) {
  const raw = String(value ?? "").trim();
  const normalized = raw.replace(",", ".");
  const number = Number(normalized);

  if (!Number.isFinite(number)) return raw;
  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function apiUrl(path) {
  return `${CONFIG.API_BASE_URL}${CONFIG.API_VERSION}${path}`;
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("eliteXToken");

  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers
  });

  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

/* Estrutura de API planejada:
   GET  /creators
   GET  /creators/:id
   GET  /content
   POST /auth/register
   POST /auth/login
   POST /subscriptions
   POST /checkout/session
   GET  /me
*/

function renderCatalog(items = mockContent) {
  $("#catalog").innerHTML = items.map((item, index) => {
    const creator = mockCreators.find(c => c.id === item.creatorId);

    return `
      <article class="card catalog-card" data-content-id="${item.id}" tabindex="0" role="button" aria-label="Abrir ${item.title}">
        <div class="thumb preview-${(index % 4) + 1}">
          <div class="preview-content">
            <span class="preview-type">${item.type}</span>
            <strong>${item.preview}</strong>
            <span class="preview-creator">${creator?.name || "Criador"}</span>
          </div>
          ${item.locked ? '<span class="lock">🔒 Exclusivo</span>' : ''}
        </div>
        <div class="info">
          <span class="badge">✓ VERIFICADO</span>
          <div class="info-row">
            <h3>${item.title}</h3>
            <span class="price">${formatBRL(item.price)}</span>
          </div>
          <p>${creator?.name || "Criador"} · ${item.type} · +18</p>
        </div>
      </article>`;
  }).join("");
}


async function contentDetail(contentId) {
  let item = null;

  try {
    const result = await apiRequest(
      `/content/${encodeURIComponent(contentId)}`
    );

    item = result.content || result;
  } catch (error) {
    console.warn(
      "ELITE-X: conteúdo da API indisponível. Tentando demonstração.",
      error
    );

    item = mockContent.find(
      content => content.id === contentId
    ) || null;
  }

  if (!item) {
    showToast("Conteúdo não encontrado.");
    return;
  }

  let creator = null;

  try {
    const result = await apiRequest(
      `/creators/${encodeURIComponent(item.creatorId)}`
    );

    creator = result.creator || result;
  } catch (error) {
    creator = mockCreators.find(
      c => c.id === item.creatorId
    ) || null;
  }

  openDrawer(`
    <div class="content-detail">
      <span class="badge">✓ VERIFICADO</span>

      <h2>${item.title}</h2>

      <p style="color:var(--muted)">
        ${creator?.name || "Criador"} · ${item.type} · +18
      </p>

      <div
        id="contentMedia"
        class="thumb preview-1"
        style="margin:20px 0;border-radius:16px;overflow:hidden;min-height:280px;"
      >
        <div class="preview-content">
          <span class="preview-type">${item.type}</span>
          <strong>${item.media ? "Carregando mídia..." : item.preview}</strong>
          <span class="preview-creator">
            ${creator?.name || "Criador"}
          </span>
        </div>

        ${item.locked ? '<span class="lock">🔒 Exclusivo</span>' : ''}
      </div>

      <div class="category-card" style="margin-bottom:20px">
        <strong>Acesso exclusivo</strong>
        <span>
          Este conteúdo está disponível para assinantes
          ou através de compra.
        </span>
      </div>

      <div class="info-row">
        <strong>Preço</strong>
        <span class="price">${formatBRL(item.price)}</span>
      </div>

      <button
        class="btn primary"
        id="contentAccessBtn"
        type="button"
      >
        ${item.locked ? "Assinar ou comprar" : "Acessar conteúdo"}
      </button>
    </div>
  `);


  if (item.media?.filename && item.id) {
    const mediaBox = document.querySelector("#contentMedia");
    const token = localStorage.getItem("eliteXToken");

    if (mediaBox && token) {
      try {
        const mediaResponse = await fetch(
          apiUrl(`/media/${encodeURIComponent(item.id)}`),
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!mediaResponse.ok) {
          throw new Error(`MEDIA ${mediaResponse.status}`);
        }

        const blob = await mediaResponse.blob();
        const mediaUrl = URL.createObjectURL(blob);

        mediaBox.innerHTML = "";

        if (item.media.mimetype?.startsWith("video/")) {
          const video = document.createElement("video");
          video.src = mediaUrl;
          video.controls = true;
          video.playsInline = true;
          video.preload = "metadata";
          video.style.width = "100%";
          video.style.display = "block";
          video.style.maxHeight = "600px";
          video.style.objectFit = "contain";
          mediaBox.appendChild(video);
        } else {
          const image = document.createElement("img");
          image.src = mediaUrl;
          image.alt = item.title || "Conteúdo ELITE-X";
          image.style.width = "100%";
          image.style.display = "block";
          image.style.maxHeight = "600px";
          image.style.objectFit = "contain";
          mediaBox.appendChild(image);
        }
      } catch (error) {
        console.warn("ELITE-X: mídia protegida indisponível.", error);

        mediaBox.innerHTML = `
          <div class="preview-content">
            <span class="preview-type">${item.type}</span>
            <strong>Acesso protegido</strong>
            <span class="preview-creator">
              A mídia não pôde ser carregada nesta sessão.
            </span>
          </div>
        `;
      }
    }
  }

  $("#contentAccessBtn").addEventListener("click", () => {
    const user = JSON.parse(
      localStorage.getItem("eliteXUser") || "null"
    );

    if (!user) {
      closeDrawer();
      loginForm();
      showToast("Entre na sua conta para continuar.");
      return;
    }

    checkoutContent(item);
  });
}


function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function openDrawer(html) {
  $("#drawerContent").innerHTML = html;
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
}

function closeDrawer() {
  $("#drawer").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
}


async function restoreSession() {
  const token = localStorage.getItem("eliteXToken");

  if (!token) {
    return null;
  }

  try {
    const result = await apiRequest("/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (result.user) {
      localStorage.setItem("eliteXUser", JSON.stringify(result.user));
      console.log("ELITE-X: sessão restaurada.", result.user.name);
      return result.user;
    }
  } catch (error) {
    console.warn("ELITE-X: sessão inválida.", error.message);

    localStorage.removeItem("eliteXToken");
    localStorage.removeItem("eliteXUser");
  }

  return null;
}

function loginForm() {
  openDrawer(`
    <h2>Entrar</h2>
    <p style="color:var(--muted)">A autenticação será conectada ao backend na próxima etapa.</p>
    <form class="form" id="loginForm">
      <label>E-mail<input type="email" name="email" required autocomplete="email"></label>
      <label>Senha<input type="password" name="password" required autocomplete="current-password"></label>
      <button class="btn primary" type="submit">Entrar</button>
      <button class="btn secondary" type="button" id="registerFromLogin">Criar conta</button>
    </form>
  `);
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (CONFIG.USE_MOCK_DATA) {
      return showToast("Login demonstrativo: backend ainda não conectado.");
    }

    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));

      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(data)
      });

      localStorage.setItem("eliteXToken", result.token);
      localStorage.setItem("eliteXUser", JSON.stringify(result.user));
      updateAuthUI(result.user);

      showToast(`Bem-vindo, ${result.user.name}!`);
      closeDrawer();
    } catch (error) {
      console.error("ELITE-X login:", error);
      showToast("Não foi possível entrar. Verifique e-mail e senha.");
    }
  });
  $("#registerFromLogin").addEventListener("click", registerForm);
}

function registerForm() {
  openDrawer(`
    <h2>Criar conta</h2>
    <p style="color:var(--muted)">Escolha se deseja acompanhar criadores ou publicar conteúdo.</p>
    <form class="form" id="registerForm">
      <label>Nome<input name="name" required autocomplete="name"></label>
      <label>E-mail<input type="email" name="email" required autocomplete="email"></label>
      <label>Senha<input type="password" name="password" minlength="8" required autocomplete="new-password"></label>
      <label>Tipo
        <select name="role"><option value="subscriber">Assinante</option><option value="creator">Criador</option></select>
      </label>
      <button class="btn primary" type="submit">Criar conta</button>
    </form>
  `);
  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (CONFIG.USE_MOCK_DATA) {
      showToast("Conta demonstrativa criada.");
      closeDrawer();
      return;
    }

    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));

      const result = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(data)
      });

      showToast(result.message || "Conta criada com sucesso.");
      closeDrawer();

      setTimeout(() => loginForm(), 700);
    } catch (error) {
      console.error("ELITE-X registro:", error);
      showToast("Não foi possível criar a conta.");
    }
  });
}

function creatorForm() {
  openDrawer(`
    <h2>Começar como criador</h2>
    <p style="color:var(--muted)">Fluxo preparado para onboarding, verificação e configuração de pagamentos.</p>
    <form class="form" id="creatorForm">
      <label>Nome público<input name="displayName" required></label>
      <label>Categoria<input name="category" placeholder="Ex.: Lifestyle, Fotos, Vídeos" required></label>
      <label>Nome de usuário<input name="username" required></label>
      <button class="btn primary" type="submit">Continuar</button>
    </form>
  `);
  $("#creatorForm").addEventListener("submit", async e => {
    e.preventDefault();

    const user = JSON.parse(
      localStorage.getItem("eliteXUser") || "null"
    );

    if (!user) {
      loginForm();
      showToast("Entre na sua conta para criar um perfil.");
      return;
    }

    const button = e.currentTarget.querySelector("button[type=\"submit\"]");

    if (button) {
      button.disabled = true;
      button.textContent = "Criando perfil...";
    }

    try {
      const data = Object.fromEntries(
        new FormData(e.currentTarget)
      );

      const result = await apiRequest("/creators", {
        method: "POST",
        body: JSON.stringify(data)
      });

      showToast(
        result.message || "Perfil de criador criado."
      );

      closeDrawer();

    } catch (error) {
      console.error("ELITE-X creator:", error);

      if (button) {
        button.disabled = false;
        button.textContent = "Continuar";
      }

      showToast(
        "Não foi possível criar o perfil de criador."
      );
    }
  });
}


function creatorDashboard(creator) {
  openDrawer(`
    <div class="creator-dashboard">
      <span class="badge">PAINEL DO CRIADOR</span>

      <h2>${creator.name}</h2>

      <p style="color:var(--muted)">
        @${creator.username || "criador"} ·
        ${Number(creator.subscribers || 0).toLocaleString("pt-BR")} assinantes
      </p>

      <div class="category-card" style="margin-top:20px;">
        <strong>Conteúdos</strong>
        <span>Publique e gerencie seus conteúdos exclusivos.</span>
      </div>

      <button class="btn primary large" id="newContentBtn" type="button" style="margin-top:16px;">
        + Novo conteúdo
      </button>

      <div id="creatorDashboardContent" style="margin-top:24px;">
        <span style="color:var(--muted)">Carregando conteúdos...</span>
      </div>
    </div>
  `);

  const newContentBtn = $("#newContentBtn");

  if (newContentBtn) {
    newContentBtn.addEventListener("click", () => {
      creatorContentForm(creator);
    });
  }

  loadCreatorDashboardContent(creator.id);
}

async function loadCreatorDashboardContent(creatorId) {
  const container = $("#creatorDashboardContent");

  if (!container) return;

  try {
    const result = await apiRequest(
      `/content?creatorId=${encodeURIComponent(creatorId)}`
    );

    const content = Array.isArray(result)
      ? result
      : (result.content || []);

    if (!content.length) {
      container.innerHTML = `
        <div class="category-card">
          <strong>Nenhum conteúdo publicado</strong>
          <span>Seu primeiro conteúdo aparecerá aqui.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = content.map(item => `
      <article class="category-card" style="margin-top:12px;">
        <strong>${item.title}</strong>
        <span>
          ${item.type} · ${formatBRL(item.price)}
          ${item.locked ? " · 🔒 Exclusivo" : ""}
        </span>
      </article>
    `).join("");

  } catch (error) {
    console.error("ELITE-X: erro ao carregar conteúdos:", error);

    container.innerHTML = `
      <div class="category-card">
        <strong>Não foi possível carregar os conteúdos.</strong>
        <span>Tente novamente.</span>
      </div>
    `;
  }
}

function creatorContentForm(creator) {
  openDrawer(`
    <div class="creator-content-form">
      <span class="badge">NOVO CONTEÚDO</span>

      <h2>Publicar conteúdo</h2>

      <p style="color:var(--muted)">
        Publicando como ${creator.name}.
      </p>

      <form class="form" id="creatorContentForm">

        <label>
          Título
          <input
            name="title"
            required
            minlength="2"
            placeholder="Ex.: Coleção Premium"
          >
        </label>

        <label>
          Tipo
          <select name="type" required>
            <option value="">Selecione</option>
            <option value="Fotos">Fotos</option>
            <option value="Vídeo">Vídeo</option>
          </select>
        </label>

        <label>
          Preço
          <input
            name="price"
            required
            placeholder="Ex.: R$ 19,90"
          >
        </label>

        <label>
          Texto da prévia
          <input
            name="preview"
            required
            minlength="2"
            placeholder="Ex.: Prévia exclusiva"
          >
        </label>

        <label>
          Arquivo
          <input
            type="file"
            name="media"
            accept="image/*,video/*"
            required
          >
        </label>

        <label style="display:flex;gap:10px;align-items:center;">
          <input
            type="checkbox"
            name="locked"
            checked
            style="width:auto;"
          >
          Conteúdo exclusivo
        </label>

        <button class="btn primary" type="submit">
          Publicar conteúdo
        </button>

      </form>
    </div>
  `);

  const form = $("#creatorContentForm");

  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const button = form.querySelector("button[type=\"submit\"]");

    if (button) {
      button.disabled = true;
      button.textContent = "Publicando...";
    }

    const formData = new FormData(form);

    formData.set(
      "locked",
      form.elements.locked.checked ? "true" : "false"
    );

    try {
      const result = await apiRequest("/content/upload", {
        method: "POST",
        body: formData
      });

      showToast(
        result.message || "Conteúdo publicado com sucesso."
      );

      creatorDashboard(creator);

    } catch (error) {
      console.error("ELITE-X: erro ao publicar conteúdo:", error);

      if (button) {
        button.disabled = false;
        button.textContent = "Publicar conteúdo";
      }

      showToast(
        error.message || "Não foi possível publicar o conteúdo."
      );
    }
  });
}

async function creatorProfile(id) {
  let c = null;

  try {
    const result = await apiRequest(`/creators/${encodeURIComponent(id)}`);

    c = result.creator || result;

    if (c) {
      c = {
        ...c,
        name: c.name || c.displayName || "Criador",
        category: c.category || "Criador",
        subscribers: Number(c.subscribers) || 0
      };
    }
  } catch (error) {
    console.warn(
      "ELITE-X: perfil real indisponível. Tentando demonstração.",
      error
    );

    c = mockCreators.find(x => x.id === id) || null;
  }

  if (!c) {
    showToast("Criador não encontrado.");
    return;
  }

  let creatorContent = [];

  try {
    const result = await apiRequest(
      `/content?creatorId=${encodeURIComponent(c.id)}`
    );

    creatorContent = Array.isArray(result)
      ? result
      : (result.content || []);
  } catch (error) {
    console.warn(
      "ELITE-X: conteúdo da API indisponível. Usando demonstração.",
      error
    );

    creatorContent = mockContent.filter(
      content => content.creatorId === c.id
    );
  }

  const contentHtml = creatorContent.length
    ? creatorContent.map((item, index) => `
        <article
          class="card catalog-card"
          data-content-id="${item.id}"
          tabindex="0"
          role="button"
          aria-label="Abrir ${item.title}"
          style="margin-top:14px;"
        >
          <div class="thumb preview-${(index % 4) + 1}" style="min-height:150px;">
            <div class="preview-content">
              <span class="preview-type">${item.type}</span>
              <strong>${item.preview}</strong>
            </div>
            ${item.locked ? '<span class="lock">🔒 Exclusivo</span>' : ''}
          </div>

          <div class="info">
            <div class="info-row">
              <h3>${item.title}</h3>
              <span class="price">${formatBRL(item.price)}</span>
            </div>
            <p>${item.type} · +18</p>
          </div>
        </article>
      `).join("")
    : `
      <div class="category-card" style="margin-top:16px;">
        <strong>Nenhum conteúdo disponível</strong>
        <span>Este criador ainda não publicou conteúdo.</span>
      </div>
    `;

  openDrawer(`
    <div class="creator-profile">
      <span class="badge">✓ VERIFICADO</span>

      <h2>${c.name}</h2>

      <p style="color:var(--muted)">
        ${c.category} · ${c.subscribers.toLocaleString("pt-BR")} assinantes
      </p>

      <hr style="border-color:var(--line);border-width:1px 0 0;margin:22px 0">

      <p>
        Perfil público de ${c.name}. Explore os conteúdos exclusivos
        disponíveis para assinantes.
      </p>

      <button class="btn primary" id="subscribeCreator" type="button">
        Assinar ${c.name}
      </button>

      <h3 style="margin-top:28px;">Conteúdos exclusivos</h3>

      <div id="creatorContentList">
        ${contentHtml}
      </div>
    </div>
  `);

  $("#subscribeCreator").addEventListener("click", () => {
    subscriptionFlow(c);
  });

  const loggedUser = JSON.parse(
    localStorage.getItem("eliteXUser") || "null"
  );

  if (loggedUser && loggedUser.id === c.userId) {
    const profile = $(".creator-profile");

    if (profile) {
      const dashboardButton = document.createElement("button");

      dashboardButton.className = "btn secondary";
      dashboardButton.type = "button";
      dashboardButton.textContent = "⚙️ Painel do criador";
      dashboardButton.style.marginTop = "10px";

      dashboardButton.addEventListener("click", () => {
        creatorDashboard(c);
      });

      profile.insertBefore(
        dashboardButton,
        $("#creatorContentList")
      );
    }
  }

  const contentList = $("#creatorContentList");

  if (contentList) {
    contentList.addEventListener("click", e => {
      const card = e.target.closest(".catalog-card");

      if (card) {
        contentDetail(card.dataset.contentId);
      }
    });

    contentList.addEventListener("keydown", e => {
      const card = e.target.closest(".catalog-card");

      if (card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        contentDetail(card.dataset.contentId);
      }
    });
  }
}



function checkoutContent(item) {
  const user = JSON.parse(localStorage.getItem("eliteXUser") || "null");

  if (!user) {
    loginForm();
    showToast("Entre na sua conta para continuar.");
    return;
  }

  const creator = mockCreators.find(c => c.id === item.creatorId);

  const subscriptions = JSON.parse(
    localStorage.getItem("eliteXSubscriptions") || "[]"
  );

  const subscribed = subscriptions.some(
    subscription => subscription.creatorId === item.creatorId
  );

  if (subscribed) {
    openDrawer(`
      <div class="checkout">
        <span class="badge">✓ ACESSO LIBERADO</span>

        <h2>${item.title}</h2>

        <p style="color:var(--muted)">
          ${creator?.name || "Criador"} · ${item.type}
        </p>

        <div class="category-card" style="margin:20px 0;">
          <strong>Conteúdo desbloqueado</strong>
          <span>Você possui uma assinatura ativa deste criador.</span>
        </div>

        <button class="btn primary" id="openSubscriberArea" type="button">
          Abrir área do assinante
        </button>
      </div>
    `);

    $("#openSubscriberArea").addEventListener("click", subscriberArea);
    return;
  }

  openDrawer(`
    <div class="checkout">
      <span class="badge">CHECKOUT</span>

      <h2>${item.title}</h2>

      <p style="color:var(--muted)">
        ${creator?.name || "Criador"} · ${item.type}
      </p>

      <div class="category-card" style="margin:20px 0;">
        <strong>Compra individual</strong>
        <span>Acesso demonstrativo a este conteúdo.</span>
        <h3>${formatBRL(item.price)}</h3>
      </div>

      <button class="btn primary" id="confirmPurchase" type="button">
        Confirmar compra demonstrativa
      </button>

      <p style="color:var(--muted);font-size:12px;margin-top:12px;">
        Nenhum pagamento real será processado nesta versão.
      </p>
    </div>
  `);

  $("#confirmPurchase").addEventListener("click", async () => {
    const button = $("#confirmPurchase");

    if (button) {
      button.disabled = true;
      button.textContent = "Registrando...";
    }

    try {
      const result = await apiRequest("/purchases", {
        method: "POST",
        body: JSON.stringify({
          contentId: item.id,
          title: item.title,
          type: item.type,
          price: item.price,
          creatorId: item.creatorId
        })
      });

      showToast(
        result.message || "Compra demonstrativa registrada."
      );

      await subscriberArea();

    } catch (error) {
      console.error("ELITE-X purchase:", error);

      if (button) {
        button.disabled = false;
        button.textContent = "Confirmar compra demonstrativa";
      }

      showToast(
        "Não foi possível registrar a compra no servidor."
      );
    }
  });
}

async function subscriberArea() {
  const user = JSON.parse(
    localStorage.getItem("eliteXUser") || "null"
  );

  if (!user) {
    loginForm();
    showToast("Entre na sua conta para acessar sua área.");
    return;
  }

  openDrawer(`
    <div class="subscriber-area">
      <span class="badge">ÁREA DO ASSINANTE</span>

      <h2>Olá, ${user.name} 👋</h2>

      <p style="color:var(--muted)">
        ${user.email}
      </p>

      <div class="category-card" style="margin-top:20px;">
        <strong>Carregando assinaturas...</strong>
        <span>Consultando sua conta no servidor.</span>
      </div>
    </div>
  `);

  try {
    const [subscriptionResult, purchaseResult] = await Promise.all([
      apiRequest("/subscriptions"),
      apiRequest("/purchases")
    ]);

    const subscriptions = subscriptionResult.subscriptions || [];
    const purchases = purchaseResult.purchases || [];

    const subscriptionHtml = subscriptions.length
      ? subscriptions.map(item => `
          <div class="category-card" style="margin-top:12px;">
            <strong>${item.creatorName}</strong>
            <span>
              ${item.plan} · ${formatBRL(item.price)} / mês
            </span>
            <small style="color:var(--muted);display:block;margin-top:6px;">
              Status: ${item.status}
            </small>
          </div>
        `).join("")
      : `
          <div class="category-card" style="margin-top:12px;">
            <strong>Nenhuma assinatura</strong>
            <span>Suas assinaturas aparecerão aqui.</span>
          </div>
        `;

    const purchaseHtml = purchases.length
      ? purchases.map(item => `
          <div class="category-card" style="margin-top:12px;">
            <strong>${item.title}</strong>
            <span>
              ${item.type} · Compra demonstrativa · ${formatBRL(item.price)}
            </span>
          </div>
        `).join("")
      : `
          <div class="category-card" style="margin-top:12px;">
            <strong>Nenhuma compra</strong>
            <span>Seus conteúdos comprados aparecerão aqui.</span>
          </div>
        `;

    openDrawer(`
      <div class="subscriber-area">
        <span class="badge">ÁREA DO ASSINANTE</span>

        <h2>Olá, ${user.name} 👋</h2>

        <p style="color:var(--muted)">
          ${user.email}
        </p>

        <h3 style="margin-top:26px;">
          Minhas assinaturas
        </h3>

        ${subscriptionHtml}

        <h3 style="margin-top:26px;">
          Minhas compras
        </h3>

        ${purchaseHtml}
      </div>
    `);

  } catch (error) {
    console.error("ELITE-X subscriber area:", error);

    openDrawer(`
      <div class="subscriber-area">
        <span class="badge">ÁREA DO ASSINANTE</span>

        <h2>Olá, ${user.name} 👋</h2>

        <div class="category-card" style="margin-top:20px;">
          <strong>Não foi possível carregar suas assinaturas.</strong>
          <span>
            Verifique se o servidor ELITE-X está online e tente novamente.
          </span>
        </div>

        <button class="btn primary" id="retrySubscriberArea" type="button">
          Tentar novamente
        </button>
      </div>
    `);

    $("#retrySubscriberArea").addEventListener(
      "click",
      subscriberArea
    );
  }
}

function userMenu(user) {
  openDrawer(`
    <h2>Olá, ${user.name} 👋</h2>
    <p style="color:var(--muted)">${user.email}</p>

    <div class="category-card" style="margin:20px 0">
      <strong>Minha conta</strong>
      <span>Área do assinante preparada para a próxima etapa.</span>
    </div>

    <button class="btn primary" id="logoutBtn" type="button">
      Sair
    </button>
  `);

  $("#logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("eliteXToken");
    localStorage.removeItem("eliteXUser");

    updateAuthUI(null);
    closeDrawer();

    showToast("Sessão encerrada.");
  });
}


function updateAuthUI(user = null) {
  const loginBtn = $("#loginBtn");
  const userBtn = $("#userBtn");
  const userName = $("#userName");

  if (user) {
    if (loginBtn) {
      loginBtn.style.display = "none";
    }

    if (userBtn) {
      userBtn.style.display = "";
      userBtn.textContent = user.name || "Minha conta";
      userBtn.onclick = () => userMenu(user);
    }

    if (userName) {
      userName.textContent = user.name || "Minha conta";
    }

    return;
  }

  if (loginBtn) {
    loginBtn.style.display = "";
    loginBtn.onclick = loginForm;
  }

  if (userBtn) {
    userBtn.style.display = "none";
    userBtn.onclick = null;
  }

  if (userName) {
    userName.textContent = "";
  }
}

function initAgeGate() {
  const ageGate = document.getElementById("age");
  const ageEnter = document.getElementById("ageEnter");

  if (!ageGate || !ageEnter) {
    console.error("ELITE-X: elementos do age gate não encontrados.");
    return;
  }

  const verified =
    localStorage.getItem("eliteXAgeVerified") === "1";

  if (verified) {
    ageGate.classList.add("hidden");
    ageGate.setAttribute("aria-hidden", "true");
  }

  ageEnter.addEventListener("click", () => {
    localStorage.setItem("eliteXAgeVerified", "1");

    ageGate.classList.add("hidden");
    ageGate.setAttribute("aria-hidden", "true");

    console.log("ELITE-X: idade confirmada.");
  });
}


async function renderCreators() {
  const container = $("#creators");
  if (!container) return;

  let creators = [];

  try {
    const result = await apiRequest("/creators");

    creators = Array.isArray(result)
      ? result
      : (result.creators || []);
  } catch (error) {
    console.error("ELITE-X: erro ao carregar criadores:", error);
  }

  if (!creators.length) {
    container.innerHTML = `
      <div class="category-card">
        <strong>Nenhum criador disponível</strong>
        <span>Os criadores aparecerão aqui quando estiverem publicados.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = creators.map(c => {
    const name = c.name || c.displayName || "Criador";
    const initials = c.initials ||
      name.trim().charAt(0).toUpperCase();

    return `
      <article class="creator-card">
        <div class="avatar">${initials}</div>

        <div>
          <strong>
            ${name}
            ${c.verified ? '<span class="verified">✓</span>' : ''}
          </strong>

          <p>
            ${c.category || "Criador"} ·
            ${Number(c.subscribers || 0).toLocaleString("pt-BR")}
            assinantes
          </p>

          <button
            class="text-btn creator-open"
            type="button"
            data-id="${c.id}"
          >
            Ver perfil →
          </button>
        </div>
      </article>
    `;
  }).join("");
}

async function init() {
  console.log("ELITE-X: inicializando interface...");

  renderCatalog();

  // Eventos essenciais: conectados antes das operações assíncronas.
  const creatorBtn = $("#creatorBtn");
  const creatorCta = $("#creatorCta");

  if (creatorBtn) {
    creatorBtn.addEventListener("click", creatorForm);
  } else {
    console.warn("ELITE-X: #creatorBtn não encontrado.");
  }

  if (creatorCta) {
    creatorCta.addEventListener("click", creatorForm);
  } else {
    console.warn("ELITE-X: #creatorCta não encontrado.");
  }

  const subscribeTop = $("#subscribeTop");
  if (subscribeTop) {
    subscribeTop.addEventListener("click", () => {
      subscriptionFlow(mockCreators[0]);
    });
  }

  const closeDrawerBtn = $("#closeDrawer");
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener("click", closeDrawer);
  }

  const drawer = $("#drawer");
  if (drawer) {
    drawer.addEventListener("click", e => {
      if (e.target === drawer) closeDrawer();
    });
  }

  const menuBtn = $("#menuBtn");
  const mobileMenu = $("#mobileMenu");

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("open");
    });
  }

  try {
    await restoreSession();
  } catch (error) {
    console.error("ELITE-X: erro ao restaurar sessão:", error);
  }

  try {
    await renderCreators();
  } catch (error) {
    console.error("ELITE-X: erro ao carregar criadores:", error);
  }

  updateAuthUI();

  const catalog = $("#catalog");

  if (catalog) {
    catalog.addEventListener("click", e => {
      const card = e.target.closest(".catalog-card");

      if (card) {
        contentDetail(card.dataset.contentId);
      }
    });

    catalog.addEventListener("keydown", e => {
      const card = e.target.closest(".catalog-card");

      if (card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        contentDetail(card.dataset.contentId);
      }
    });
  }

  const creators = $("#creators");

  if (creators) {
    creators.addEventListener("click", e => {
      const btn = e.target.closest(".creator-open");

      if (btn) {
        creatorProfile(btn.dataset.id);
      }
    });
  }

  document.querySelectorAll(".category-card").forEach(btn => {
    btn.addEventListener("click", () => {
      showToast(
        `Filtro "${btn.dataset.category}" preparado para a API.`
      );
    });
  });

  const showAll = $("#showAll");

  if (showAll) {
    showAll.addEventListener("click", () => {
      renderCatalog([...mockContent, ...mockContent]);
      showToast("Catálogo expandido no modo demonstração.");
    });
  }

  console.log("ELITE-X: interface inicializada.");
}

document.addEventListener("DOMContentLoaded", init);
