const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

const app = express();

const PRIVATE_MEDIA_DIR = path.join(__dirname, ".private_media");

if (!fs.existsSync(PRIVATE_MEDIA_DIR)) {
  fs.mkdirSync(PRIVATE_MEDIA_DIR, { recursive: true });
}

const upload = multer({
  dest: PRIVATE_MEDIA_DIR,
  limits: {
    fileSize: 200 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      return cb(null, true);
    }

    cb(new Error("Apenas imagens e vídeos são permitidos."));
  }
});
const PORT = process.env.PORT || 3001;

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      {
        users: [],
        creators: [],
        posts: [],
        subscriptions: []
      },
      null,
      2
    )
  );
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function loadDB() {
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

  db.users ||= [];
  db.creators ||= [];
  db.posts ||= [];
  db.subscriptions ||= [];
  db.purchases ||= [];
  db.sessions ||= [];

  return db;
}

function saveDB(db) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2)
  );
}


app.get("/api/status", (req, res) => {
  res.json({
    name: "ELITE-X",
    version: "0.1.0",
    status: "online",
    environment: "local"
  });
});


function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto.scryptSync(
    password,
    salt,
    64
  ).toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  const [salt, originalHash] = storedPassword.split(":");

  if (!salt || !originalHash) {
    return false;
  }

  const hash = crypto.scryptSync(
    password,
    salt,
    64
  ).toString("hex");

  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(originalHash, "hex")
  );
}

app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Nome, e-mail e senha são obrigatórios."
    });
  }

  if (name.trim().length < 2) {
    return res.status(400).json({
      error: "O nome deve ter pelo menos 2 caracteres."
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: "A senha deve ter pelo menos 8 caracteres."
    });
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  db.users ||= [];
  db.sessions ||= [];

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = db.users.find(
    user => user.email === normalizedEmail
  );

  if (existingUser) {
    return res.status(409).json({
      error: "Este e-mail já está cadastrado."
    });
  }

  const user = {
    id: `user_${crypto.randomUUID()}`,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    role: "subscriber",
    createdAt: new Date().toISOString()
  };

  db.users.push(user);

  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2)
  );

  res.status(201).json({
    message: "Conta criada com sucesso.",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    }
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "E-mail e senha são obrigatórios."
    });
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  db.users ||= [];
  db.sessions ||= [];

  const normalizedEmail = email.trim().toLowerCase();

  const user = db.users.find(
    item => item.email === normalizedEmail
  );

  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({
      error: "E-mail ou senha inválidos."
    });
  }

  const token = crypto.randomBytes(32).toString("hex");

  db.sessions.push({
    token,
    userId: user.id,
    createdAt: new Date().toISOString()
  });

  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2)
  );

  res.json({
    message: "Login realizado com sucesso.",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});


app.get("/api/me", (req, res) => {
  const db = loadDB();
  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Sessão não informada."
    });
  }

  const token = auth.slice(7).trim();

  const session = db.sessions.find((item) => item.token === token);

  if (!session) {
    return res.status(401).json({
      message: "Sessão inválida ou expirada."
    });
  }

  const user = db.users.find((item) => item.id === session.userId);

  if (!user) {
    return res.status(401).json({
      message: "Usuário da sessão não encontrado."
    });
  }

  const { passwordHash, ...safeUser } = user;

  res.json({
    user: safeUser
  });
});


function getAuthenticatedUser(req) {
  const db = loadDB();
  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return null;
  }

  const token = auth.slice(7).trim();
  const session = db.sessions.find(item => item.token === token);

  if (!session) {
    return null;
  }

  return db.users.find(item => item.id === session.userId) || null;
}

app.post("/api/subscriptions", (req, res) => {
  const db = loadDB();
  const user = getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({
      message: "Sessão inválida ou não informada."
    });
  }

  const {
    creatorId,
    creatorName,
    plan = "Premium",
    price = "R$ 29,90"
  } = req.body || {};

  if (!creatorId || !creatorName) {
    return res.status(400).json({
      message: "creatorId e creatorName são obrigatórios."
    });
  }

  const existing = db.subscriptions.find(
    item =>
      item.userId === user.id &&
      item.creatorId === creatorId
  );

  if (existing) {
    return res.json({
      message: "Assinatura já existente.",
      subscription: existing
    });
  }

  const subscription = {
    id: `sub_${crypto.randomUUID()}`,
    userId: user.id,
    creatorId,
    creatorName,
    plan,
    price,
    status: "active",
    startedAt: new Date().toISOString()
  };

  db.subscriptions.push(subscription);
  saveDB(db);

  res.status(201).json({
    message: "Assinatura criada com sucesso.",
    subscription
  });
});

app.get("/api/subscriptions", (req, res) => {
  const db = loadDB();
  const user = getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({
      message: "Sessão inválida ou não informada."
    });
  }

  const subscriptions = db.subscriptions.filter(
    item => item.userId === user.id
  );

  res.json({
    subscriptions
  });
});

app.post("/api/purchases", (req, res) => {
  const db = loadDB();
  const user = getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({
      message: "Sessão inválida ou não informada."
    });
  }

  const {
    contentId,
    title,
    type,
    price,
    creatorId
  } = req.body || {};

  if (!contentId || !title || !type || !price || !creatorId) {
    return res.status(400).json({
      message: "Dados da compra incompletos."
    });
  }

  const existing = db.purchases.find(
    item =>
      item.userId === user.id &&
      item.contentId === contentId
  );

  if (existing) {
    return res.json({
      message: "Compra já registrada.",
      purchase: existing
    });
  }

  const purchase = {
    id: `purchase_${crypto.randomUUID()}`,
    userId: user.id,
    contentId,
    title,
    type,
    price,
    creatorId,
    status: "completed",
    purchasedAt: new Date().toISOString()
  };

  db.purchases.push(purchase);
  saveDB(db);

  res.status(201).json({
    message: "Compra registrada com sucesso.",
    purchase
  });
});

app.get("/api/purchases", (req, res) => {
  const db = loadDB();
  const user = getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({
      message: "Sessão inválida ou não informada."
    });
  }

  const purchases = db.purchases.filter(
    item => item.userId === user.id
  );

  res.json({
    purchases
  });
});

app.post("/api/creators", (req, res) => {
  const db = loadDB();
  const user = getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({
      message: "Sessão inválida ou não informada."
    });
  }

  const {
    displayName,
    category,
    username
  } = req.body || {};

  if (!displayName || !category || !username) {
    return res.status(400).json({
      message: "Nome público, categoria e nome de usuário são obrigatórios."
    });
  }

  const cleanDisplayName = displayName.trim();
  const cleanCategory = category.trim();
  const cleanUsername = username.trim().toLowerCase();

  if (
    cleanDisplayName.length < 2 ||
    cleanCategory.length < 2 ||
    cleanUsername.length < 3
  ) {
    return res.status(400).json({
      message: "Os dados informados são inválidos."
    });
  }

  const usernameExists = db.creators.some(
    creator => creator.username === cleanUsername
  );

  if (usernameExists) {
    return res.status(409).json({
      message: "Este nome de usuário já está em uso."
    });
  }

  const existingCreator = db.creators.find(
    creator => creator.userId === user.id
  );

  if (existingCreator) {
    return res.status(409).json({
      message: "Esta conta já possui um perfil de criador.",
      creator: existingCreator
    });
  }

  const creator = {
    id: `creator_${crypto.randomUUID()}`,
    userId: user.id,
    name: cleanDisplayName,
    username: cleanUsername,
    category: cleanCategory,
    verified: false,
    subscribers: 0,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  db.creators.push(creator);
  saveDB(db);

  res.status(201).json({
    message: "Perfil de criador criado com sucesso.",
    creator
  });
});

app.get("/api/creators", (req, res) => {
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  res.json(db.creators);
});

app.get("/api/creators/:id", (req, res) => {
  const db = loadDB();

  const creator = db.creators.find(
    item => item.id === req.params.id
  );

  if (!creator) {
    return res.status(404).json({
      message: "Criador não encontrado."
    });
  }

  res.json({
    creator
  });
});



app.post("/api/content/upload", upload.single("media"), (req, res) => {
  const db = loadDB();
  const user = getAuthenticatedUser(req);

  if (!user) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(401).json({
      message: "Sessão inválida ou não informada."
    });
  }

  const creator = db.creators.find(
    item => item.userId === user.id
  );

  if (!creator) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(403).json({
      message: "Crie um perfil de criador antes de publicar."
    });
  }

  if (!req.file) {
    return res.status(400).json({
      message: "Selecione uma foto ou vídeo."
    });
  }

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime"
  ];

  if (!allowed.includes(req.file.mimetype)) {
    fs.unlinkSync(req.file.path);

    return res.status(400).json({
      message: "Formato de mídia não permitido."
    });
  }

  const content = {
    id: `content_${crypto.randomUUID()}`,
    creatorId: creator.id,
    title: String(req.body.title || "Conteúdo").trim(),
    type: req.file.mimetype.startsWith("video/")
      ? "Vídeo"
      : "Fotos",
    price: String(req.body.price || "").trim(),
    preview: String(req.body.preview || "Conteúdo exclusivo").trim(),
    locked: req.body.locked !== "false",
    media: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    },
    createdAt: new Date().toISOString()
  };

  if (!content.price) {
    fs.unlinkSync(req.file.path);

    return res.status(400).json({
      message: "Informe o preço."
    });
  }

  db.posts.push(content);
  saveDB(db);

  res.status(201).json({
    message: "Mídia enviada e conteúdo criado.",
    content
  });
});

app.post("/api/content", (req, res) => {
  const db = loadDB();
  const user = getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({
      message: "Sessão inválida ou não informada."
    });
  }

  const creator = db.creators.find(
    item => item.userId === user.id
  );

  if (!creator) {
    return res.status(403).json({
      message: "Crie um perfil de criador antes de publicar conteúdo."
    });
  }

  const {
    title,
    type,
    price,
    preview,
    locked
  } = req.body || {};

  if (!title || !type || !price || !preview) {
    return res.status(400).json({
      message: "Título, tipo, preço e prévia são obrigatórios."
    });
  }

  const cleanTitle = String(title).trim();
  const cleanType = String(type).trim();
  const cleanPrice = String(price).trim();
  const cleanPreview = String(preview).trim();

  if (
    cleanTitle.length < 2 ||
    cleanType.length < 2 ||
    cleanPrice.length < 2 ||
    cleanPreview.length < 2
  ) {
    return res.status(400).json({
      message: "Os dados informados são inválidos."
    });
  }

  const post = {
    id: `content_${crypto.randomUUID()}`,
    creatorId: creator.id,
    title: cleanTitle,
    type: cleanType,
    price: cleanPrice,
    preview: cleanPreview,
    locked: locked !== false,
    createdAt: new Date().toISOString()
  };

  db.posts.push(post);
  saveDB(db);

  res.status(201).json({
    message: "Conteúdo criado com sucesso.",
    content: post
  });
});

app.get("/api/content", (req, res) => {
  const db = loadDB();

  let posts = db.posts;

  if (req.query.creatorId) {
    posts = posts.filter(
      post => post.creatorId === req.query.creatorId
    );
  }

  res.json({
    content: posts
  });
});

app.get("/api/content/:id", (req, res) => {
  const db = loadDB();

  const post = db.posts.find(
    item => item.id === req.params.id
  );

  if (!post) {
    return res.status(404).json({
      message: "Conteúdo não encontrado."
    });
  }

  res.json({
    content: post
  });
});


app.get("/api/media/:contentId", (req, res) => {
  const db = loadDB();
  const user = getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({
      message: "Sessão necessária."
    });
  }

  const post = db.posts.find(
    item => item.id === req.params.contentId
  );

  if (!post || !post.media) {
    return res.status(404).json({
      message: "Mídia não encontrada."
    });
  }

  const creator = db.creators.find(
    item => item.id === post.creatorId
  );

  if (!creator || creator.userId !== user.id) {
    return res.status(403).json({
      message: "Acesso à mídia não autorizado."
    });
  }

  const filename = path.basename(post.media.filename);
  const filePath = path.join(PRIVATE_MEDIA_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      message: "Arquivo físico não encontrado."
    });
  }

  res.set(
    "Content-Type",
    post.media.mimetype || "application/octet-stream"
  );

  res.sendFile(filePath);
});

app.use(express.static(__dirname));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("================================");
  console.log("       ELITE-X BACKEND");
  console.log("================================");
  console.log(`Servidor: http://127.0.0.1:${PORT}`);
  console.log(`API:      http://127.0.0.1:${PORT}/api/status`);
  console.log("Status:   ONLINE");
});
