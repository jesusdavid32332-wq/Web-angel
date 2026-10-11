import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import {
  getDb,
  saveDb,
  createInitialDatabase,
} from './src/server/store.ts';
import type {
  ProductItem,
  CategoryItem,
  ImageAsset,
  PageSectionConfig,
  ButtonLinkConfig,
  BusinessIdentity,
  VisualConfig,
} from './src/server/store.ts';
import {
  COOKIE_NAME,
  createSessionToken,
  revokeSessionToken,
  extractToken,
  verifySessionToken,
  requireAdminAuth,
} from './src/server/auth.ts';
import type {
  AuthenticatedRequest,
} from './src/server/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());

// Configure Multer in-memory storage with strict validation (JPG, PNG, WebP, max 8MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8 MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Solo se aceptan imágenes JPG, PNG y WebP.'));
    }
  },
});

// Helper to prevent caching on dynamic API routes
function noCache(_req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

// ==========================================
// 1. PERSISTENT MEDIA STREAMING ENDPOINT
// ==========================================
app.get('/api/media/:id', (req, res) => {
  const db = getDb();
  const asset = db.images.find((img) => img.id === req.params.id || img.key === req.params.id);
  if (!asset || !asset.url) {
    return res.status(404).send('Imagen no encontrada');
  }

  // If it's a data URL, parse and stream binary with ETag
  if (asset.url.startsWith('data:')) {
    const match = asset.url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!match) {
      return res.status(500).send('Formato de imagen inválido');
    }
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const etag = `"${asset.id}-${buffer.length}-${asset.createdAt}"`;

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    res.setHeader('ETag', etag);
    return res.send(buffer);
  }

  // If external URL
  return res.redirect(asset.url);
});

// ==========================================
// 2. PUBLIC API ENDPOINTS (READ-ONLY)
// ==========================================
app.get('/api/public/site-data', noCache, (_req, res) => {
  try {
    const db = getDb();
    // Filter only active categories and active products sorted by order
    const activeCategories = [...db.categories]
      .filter((c) => c.active)
      .sort((a, b) => a.order - b.order);

    const activeProducts = [...db.products]
      .filter((p) => p.active)
      .sort((a, b) => a.order - b.order);

    const orderedSections = [...db.sections].sort((a, b) => a.order - b.order);

    // Map image keys for legacy data-i compatibility
    const imageMap: Record<string, string> = {};
    for (const img of db.images) {
      imageMap[img.id] = `/api/media/${img.id}?v=${encodeURIComponent(img.createdAt)}`;
      if (img.key) {
        imageMap[img.key] = `/api/media/${img.id}?v=${encodeURIComponent(img.createdAt)}`;
      }
    }

    res.json({
      updatedAt: db.updatedAt,
      identity: db.identity,
      visual: db.visual,
      categories: activeCategories,
      products: activeProducts,
      sections: orderedSections,
      buttons: db.buttons,
      marqueeItems: db.marqueeItems,
      imageMap,
    });
  } catch (err: any) {
    console.error('Error serving public site data:', err);
    res.status(500).json({ error: 'Error al cargar los datos públicos del sitio.' });
  }
});

app.get('/api/public/products', noCache, (_req, res) => {
  const db = getDb();
  const activeProducts = [...db.products]
    .filter((p) => p.active)
    .sort((a, b) => a.order - b.order);
  res.json({ products: activeProducts, updatedAt: db.updatedAt });
});

// ==========================================
// 3. AUTHENTICATION ENDPOINTS
// ==========================================
app.get('/api/auth/status', noCache, (req, res) => {
  const db = getDb();
  const initialized = db.admins.length > 0;
  const token = extractToken(req);
  const admin = token ? verifySessionToken(token) : null;

  res.json({
    initialized,
    authenticated: Boolean(admin),
    admin: admin
      ? {
          id: admin.sub,
          username: admin.username,
          email: admin.email,
        }
      : null,
  });
});

// First-time admin account setup (only works when 0 admins exist in DB)
app.post('/api/auth/setup', noCache, async (req, res) => {
  try {
    const db = getDb();
    if (db.admins.length > 0) {
      return res.status(403).json({
        error: 'El administrador principal ya fue configurado. Por favor inicia sesión con tus credenciales.',
      });
    }

    const { username, email, password, setupCode } = req.body || {};

    // If ADMIN_SETUP_TOKEN env var is configured, verify it
    if (process.env.ADMIN_SETUP_TOKEN && process.env.ADMIN_SETUP_TOKEN !== setupCode) {
      return res.status(403).json({
        error: 'Código de configuración inicial inválido.',
      });
    }

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres.' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres por seguridad.' });
    }

    const cleanUsername = username.trim();
    const cleanEmail = (email || `${cleanUsername}@personalizadosangel.com`).trim();
    const passwordHash = await bcrypt.hash(password, 10);

    const newAdmin = {
      id: `admin_${crypto.randomUUID()}`,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    db.admins.push(newAdmin);
    saveDb(db);

    const token = createSessionToken(newAdmin);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      token,
      admin: {
        id: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.email,
      },
    });
  } catch (err: any) {
    console.error('Setup error:', err);
    return res.status(500).json({ error: 'Error interno al crear la cuenta de administrador.' });
  }
});

// Login endpoint
app.post('/api/auth/login', noCache, async (req, res) => {
  try {
    const db = getDb();
    if (db.admins.length === 0) {
      return res.status(400).json({
        error: 'No hay cuenta administrativa configurada aún. Completa el registro inicial.',
        needsSetup: true,
      });
    }

    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Ingresa tu usuario/correo y contraseña.' });
    }

    const cleanUser = String(username).trim().toLowerCase();
    const admin = db.admins.find(
      (a) => a.username.toLowerCase() === cleanUser || a.email.toLowerCase() === cleanUser
    );

    if (!admin) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu usuario o contraseña.' });
    }

    const valid = await bcrypt.compare(String(password), admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu usuario o contraseña.' });
    }

    admin.lastLogin = new Date().toISOString();
    saveDb(db);

    const token = createSessionToken(admin);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Error interno durante el inicio de sesión.' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', noCache, (req, res) => {
  const token = extractToken(req);
  if (token) {
    revokeSessionToken(token);
  }
  res.clearCookie(COOKIE_NAME);
  return res.json({ success: true });
});

// Change admin credentials
app.put('/api/admin/credentials', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newUsername, newEmail, newPassword } = req.body || {};
    const db = getDb();
    const admin = db.admins.find((a) => a.id === req.admin?.sub);
    if (!admin) {
      return res.status(404).json({ error: 'Administrador no encontrado.' });
    }

    if (!currentPassword) {
      return res.status(400).json({ error: 'Debes ingresar tu contraseña actual para confirmar los cambios.' });
    }

    const valid = await bcrypt.compare(String(currentPassword), admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }

    if (newUsername && String(newUsername).trim().length >= 3) {
      admin.username = String(newUsername).trim();
    }
    if (newEmail && String(newEmail).trim().includes('@')) {
      admin.email = String(newEmail).trim();
    }
    if (newPassword) {
      if (String(newPassword).length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 8 caracteres.' });
      }
      admin.passwordHash = await bcrypt.hash(String(newPassword), 10);
    }

    saveDb(db);
    return res.json({
      success: true,
      admin: { id: admin.id, username: admin.username, email: admin.email },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al actualizar las credenciales.' });
  }
});

// ==========================================
// 4. PROTECTED ADMIN API ENDPOINTS
// ==========================================

// Full state & dashboard statistics
app.get('/api/admin/state', requireAdminAuth, noCache, (_req, res) => {
  const db = getDb();
  const imagesSummary = db.images.map((img) => ({
    id: img.id,
    key: img.key,
    name: img.name,
    category: img.category,
    url: img.url.startsWith('data:') ? `/api/media/${img.id}?v=${encodeURIComponent(img.createdAt)}` : img.url,
    mimeType: img.mimeType,
    sizeBytes: img.sizeBytes,
    createdAt: img.createdAt,
  }));

  const stats = {
    totalProducts: db.products.length,
    activeProducts: db.products.filter((p) => p.active).length,
    inactiveProducts: db.products.filter((p) => !p.active).length,
    totalCategories: db.categories.length,
    activeCategories: db.categories.filter((c) => c.active).length,
    totalImages: db.images.length,
    activeSections: db.sections.filter((s) => s.active).length,
    totalSections: db.sections.length,
    updatedAt: db.updatedAt,
  };

  res.json({
    stats,
    identity: db.identity,
    visual: db.visual,
    categories: [...db.categories].sort((a, b) => a.order - b.order),
    products: [...db.products].sort((a, b) => a.order - b.order),
    sections: [...db.sections].sort((a, b) => a.order - b.order),
    buttons: db.buttons,
    images: imagesSummary,
    marqueeItems: db.marqueeItems,
  });
});

// A. Update Business Identity
app.put('/api/admin/identity', requireAdminAuth, (req, res) => {
  try {
    const payload = req.body as Partial<BusinessIdentity>;
    if (!payload || !payload.commercialName || String(payload.commercialName).trim().length === 0) {
      return res.status(400).json({ error: 'El nombre comercial es obligatorio.' });
    }

    const db = getDb();
    db.identity = {
      ...db.identity,
      ...payload,
      commercialName: String(payload.commercialName).trim(),
      socialLinks: {
        ...db.identity.socialLinks,
        ...(payload.socialLinks || {}),
      },
    };

    // Also keep hero/contact whatsapp numbers in sync if changed
    if (payload.whatsappNumber) {
      const cleanWa = String(payload.whatsappNumber).replace(/[^0-9]/g, '');
      db.identity.whatsappNumber = cleanWa;
    }

    saveDb(db);
    return res.json({ success: true, identity: db.identity, updatedAt: db.updatedAt });
  } catch (err: any) {
    console.error('Error updating identity:', err);
    return res.status(500).json({ error: 'No se pudo guardar la identidad del negocio.' });
  }
});

// G. Update Visual Configuration
app.put('/api/admin/visual', requireAdminAuth, (req, res) => {
  try {
    const payload = req.body as Partial<VisualConfig>;
    const db = getDb();

    // Clamp numeric values to safe boundaries so mobile layout never breaks
    const titleSizeScale = Math.min(1.25, Math.max(0.8, Number(payload.titleSizeScale ?? db.visual.titleSizeScale)));
    const sectionSpacing = Math.min(96, Math.max(28, Number(payload.sectionSpacing ?? db.visual.sectionSpacing)));
    const cardBorderRadius = Math.min(32, Math.max(4, Number(payload.cardBorderRadius ?? db.visual.cardBorderRadius)));
    const buttonBorderRadius = Math.min(32, Math.max(4, Number(payload.buttonBorderRadius ?? db.visual.buttonBorderRadius)));
    const cardShadowIntensity = Math.min(100, Math.max(0, Number(payload.cardShadowIntensity ?? db.visual.cardShadowIntensity)));
    const effectIntensity = Math.min(100, Math.max(0, Number(payload.effectIntensity ?? db.visual.effectIntensity)));

    db.visual = {
      ...db.visual,
      ...payload,
      titleSizeScale,
      sectionSpacing,
      cardBorderRadius,
      buttonBorderRadius,
      cardShadowIntensity,
      effectIntensity,
    };

    saveDb(db);
    return res.json({ success: true, visual: db.visual, updatedAt: db.updatedAt });
  } catch (err: any) {
    console.error('Error updating visual config:', err);
    return res.status(500).json({ error: 'No se pudo guardar la configuración visual.' });
  }
});

// C. Products CRUD
app.post('/api/admin/products', requireAdminAuth, (req, res) => {
  try {
    const body = req.body as Partial<ProductItem>;
    if (!body.name || String(body.name).trim().length === 0) {
      return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
    }

    const db = getDb();
    const now = new Date().toISOString();
    const maxOrder = db.products.reduce((max, p) => Math.max(max, p.order || 0), 0);

    const newProduct: ProductItem = {
      id: `prod_${crypto.randomUUID().slice(0, 8)}`,
      name: String(body.name).trim(),
      description: String(body.description || '').trim(),
      price: body.price !== undefined && body.price !== null && String(body.price) !== '' ? Number(body.price) : null,
      consultPrice: body.consultPrice !== undefined ? Boolean(body.consultPrice) : true,
      priceLabel: String(body.priceLabel || 'Solicita precio').trim(),
      mainImage: String(body.mainImage || '/api/media/img_p1').trim(),
      galleryImages: Array.isArray(body.galleryImages) && body.galleryImages.length > 0
        ? body.galleryImages
        : [String(body.mainImage || '/api/media/img_p1').trim()],
      categoryId: String(body.categoryId || (db.categories[0]?.id ?? 'cat_familia')),
      order: body.order !== undefined ? Number(body.order) : maxOrder + 1,
      active: body.active !== undefined ? Boolean(body.active) : true,
      featured: body.featured !== undefined ? Boolean(body.featured) : false,
      inCarousel: body.inCarousel !== undefined ? Boolean(body.inCarousel) : true,
      consultButtonText: String(body.consultButtonText || 'Consultar producto').trim(),
      viewPhotoButtonText: String(body.viewPhotoButtonText || 'Ver foto').trim(),
      whatsappMessage: String(
        body.whatsappMessage ||
          'Hola, buenas. Vi su página web y estoy interesado en el producto {nombre}. ¿Me pueden brindar más información sobre el precio, las características y la disponibilidad? Gracias.'
      ).trim(),
      createdAt: now,
      updatedAt: now,
    };

    db.products.push(newProduct);
    saveDb(db);
    return res.json({ success: true, product: newProduct, updatedAt: db.updatedAt });
  } catch (err: any) {
    console.error('Error creating product:', err);
    return res.status(500).json({ error: 'Error al crear el producto.' });
  }
});

app.put('/api/admin/products/reorder', requireAdminAuth, (req, res) => {
  try {
    const { orderedIds } = req.body as { orderedIds: string[] };
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'Lista de orden inválida.' });
    }
    const db = getDb();
    orderedIds.forEach((id, index) => {
      const prod = db.products.find((p) => p.id === id);
      if (prod) prod.order = index + 1;
    });
    saveDb(db);
    return res.json({
      success: true,
      products: [...db.products].sort((a, b) => a.order - b.order),
      updatedAt: db.updatedAt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al reordenar productos.' });
  }
});

app.put('/api/admin/products/:id', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const index = db.products.findIndex((p) => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const body = req.body as Partial<ProductItem>;
    if (body.name !== undefined && String(body.name).trim().length === 0) {
      return res.status(400).json({ error: 'El nombre del producto no puede estar vacío.' });
    }

    const existing = db.products[index];
    const updated: ProductItem = {
      ...existing,
      ...body,
      id: existing.id,
      name: body.name !== undefined ? String(body.name).trim() : existing.name,
      description: body.description !== undefined ? String(body.description).trim() : existing.description,
      price:
        body.price !== undefined
          ? body.price !== null && String(body.price) !== ''
            ? Number(body.price)
            : null
          : existing.price,
      mainImage: body.mainImage ? String(body.mainImage).trim() : existing.mainImage,
      galleryImages: Array.isArray(body.galleryImages) ? body.galleryImages : existing.galleryImages,
      updatedAt: new Date().toISOString(),
    };

    db.products[index] = updated;
    saveDb(db);
    return res.json({ success: true, product: updated, updatedAt: db.updatedAt });
  } catch (err: any) {
    console.error('Error updating product:', err);
    return res.status(500).json({ error: 'Error al actualizar el producto.' });
  }
});

app.delete('/api/admin/products/:id', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const initialLen = db.products.length;
    db.products = db.products.filter((p) => p.id !== req.params.id);
    if (db.products.length === initialLen) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    saveDb(db);
    return res.json({ success: true, updatedAt: db.updatedAt });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al eliminar el producto.' });
  }
});

// D. Categories CRUD
app.post('/api/admin/categories', requireAdminAuth, (req, res) => {
  try {
    const body = req.body as Partial<CategoryItem>;
    if (!body.name || String(body.name).trim().length === 0) {
      return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
    }
    const db = getDb();
    const maxOrder = db.categories.reduce((max, c) => Math.max(max, c.order || 0), 0);
    const newCat: CategoryItem = {
      id: `cat_${crypto.randomUUID().slice(0, 8)}`,
      name: String(body.name).trim(),
      description: String(body.description || '').trim(),
      image: String(body.image || '/api/media/img_p1').trim(),
      order: body.order !== undefined ? Number(body.order) : maxOrder + 1,
      active: body.active !== undefined ? Boolean(body.active) : true,
    };
    db.categories.push(newCat);
    saveDb(db);
    return res.json({ success: true, category: newCat, updatedAt: db.updatedAt });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al crear la categoría.' });
  }
});

app.put('/api/admin/categories/:id', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const idx = db.categories.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }
    const body = req.body as Partial<CategoryItem>;
    if (body.name !== undefined && String(body.name).trim().length === 0) {
      return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
    }
    db.categories[idx] = {
      ...db.categories[idx],
      ...body,
      id: db.categories[idx].id,
      name: body.name !== undefined ? String(body.name).trim() : db.categories[idx].name,
    };
    saveDb(db);
    return res.json({ success: true, category: db.categories[idx], updatedAt: db.updatedAt });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al guardar la categoría.' });
  }
});

app.delete('/api/admin/categories/:id', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    if (db.categories.length <= 1) {
      return res.status(400).json({ error: 'Debe existir al menos una categoría en el catálogo.' });
    }
    const targetId = req.params.id;
    db.categories = db.categories.filter((c) => c.id !== targetId);
    const fallbackId = db.categories[0].id;
    db.products.forEach((p) => {
      if (p.categoryId === targetId) {
        p.categoryId = fallbackId;
      }
    });
    saveDb(db);
    return res.json({ success: true, updatedAt: db.updatedAt });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al eliminar la categoría.' });
  }
});

// E. Page Sections & Marquee
app.put('/api/admin/sections', requireAdminAuth, (req, res) => {
  try {
    const { sections, marqueeItems } = req.body as {
      sections?: PageSectionConfig[];
      marqueeItems?: string[];
    };
    const db = getDb();
    if (Array.isArray(sections)) {
      db.sections = sections.map((sec, idx) => ({
        ...sec,
        order: sec.order !== undefined ? Number(sec.order) : idx + 1,
      }));
    }
    if (Array.isArray(marqueeItems)) {
      db.marqueeItems = marqueeItems.map((m) => String(m).trim()).filter(Boolean);
    }
    saveDb(db);
    return res.json({
      success: true,
      sections: db.sections,
      marqueeItems: db.marqueeItems,
      updatedAt: db.updatedAt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al actualizar las secciones de la página.' });
  }
});

// F. Buttons and Links
app.put('/api/admin/buttons', requireAdminAuth, (req, res) => {
  try {
    const { buttons } = req.body as { buttons: ButtonLinkConfig[] };
    if (!Array.isArray(buttons)) {
      return res.status(400).json({ error: 'Formato de botones inválido.' });
    }
    const db = getDb();
    db.buttons = buttons;
    saveDb(db);
    return res.json({ success: true, buttons: db.buttons, updatedAt: db.updatedAt });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al guardar los botones y enlaces.' });
  }
});

// B & 7. Image Upload and Media Manager
app.post('/api/admin/images', requireAdminAuth, (req, res) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({
        error: err.message || 'Error al procesar el archivo de imagen.',
      });
    }

    try {
      const db = getDb();
      const now = new Date().toISOString();
      const { name, category, replaceId, assignTo } = req.body || {};

      let dataUrl = '';
      let mimeType = 'image/jpeg';
      let sizeBytes = 0;

      if (req.file) {
        mimeType = req.file.mimetype;
        sizeBytes = req.file.size;
        const base64 = req.file.buffer.toString('base64');
        dataUrl = `data:${mimeType};base64,${base64}`;
      } else if (req.body.base64Data && typeof req.body.base64Data === 'string') {
        if (!req.body.base64Data.startsWith('data:image/')) {
          return res.status(400).json({ error: 'El archivo seleccionado no es una imagen válida.' });
        }
        dataUrl = req.body.base64Data;
        const m = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,/);
        mimeType = m ? m[1] : 'image/jpeg';
        sizeBytes = Buffer.byteLength(dataUrl, 'utf8');
      } else {
        return res.status(400).json({ error: 'No se recibió ningún archivo de imagen.' });
      }

      if (sizeBytes > 8 * 1024 * 1024) {
        return res.status(400).json({ error: 'La imagen supera el límite máximo permitido de 8 MB.' });
      }

      let targetAsset: ImageAsset;

      if (replaceId) {
        const existingIdx = db.images.findIndex((i) => i.id === replaceId || i.key === replaceId);
        if (existingIdx !== -1) {
          db.images[existingIdx] = {
            ...db.images[existingIdx],
            name: name ? String(name).trim() : db.images[existingIdx].name,
            category: (category as any) || db.images[existingIdx].category,
            url: dataUrl,
            mimeType,
            sizeBytes,
            createdAt: now,
          };
          targetAsset = db.images[existingIdx];
        } else {
          const newId = `img_${crypto.randomUUID().slice(0, 8)}`;
          targetAsset = {
            id: newId,
            key: newId,
            name: String(name || req.file?.originalname || 'Imagen subida').trim(),
            category: (category as any) || 'other',
            url: dataUrl,
            mimeType,
            sizeBytes,
            createdAt: now,
          };
          db.images.unshift(targetAsset);
        }
      } else {
        const newId = `img_${crypto.randomUUID().slice(0, 8)}`;
        targetAsset = {
          id: newId,
          key: newId,
          name: String(name || req.file?.originalname || 'Imagen nueva').trim(),
          category: (category as any) || 'other',
          url: dataUrl,
          mimeType,
          sizeBytes,
          createdAt: now,
        };
        db.images.unshift(targetAsset);
      }

      const publicUrl = `/api/media/${targetAsset.id}?v=${encodeURIComponent(now)}`;

      // Optional automatic assignment helper
      if (assignTo === 'mainLogo') {
        db.identity.mainLogo = publicUrl;
        db.identity.headerLogo = publicUrl;
      } else if (assignTo === 'coverImage') {
        db.identity.coverImage = publicUrl;
        const heroSec = db.sections.find((s) => s.key === 'hero');
        if (heroSec) heroSec.image = publicUrl;
      } else if (assignTo === 'favicon') {
        db.identity.favicon = publicUrl;
      } else if (assignTo === 'flyer') {
        const flyerSec = db.sections.find((s) => s.key === 'flyer');
        if (flyerSec) flyerSec.image = publicUrl;
      }

      saveDb(db);

      return res.json({
        success: true,
        image: {
          ...targetAsset,
          url: publicUrl,
        },
        publicUrl,
        updatedAt: db.updatedAt,
      });
    } catch (e: any) {
      console.error('Upload error:', e);
      return res.status(500).json({ error: 'Error interno al guardar la imagen.' });
    }
  });
});

app.delete('/api/admin/images/:id', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const target = db.images.find((i) => i.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Imagen no encontrada.' });
    }

    // Check if image is currently used by identity, products, categories, or sections
    const mediaPrefix = `/api/media/${target.id}`;
    const usedInProducts = db.products.filter(
      (p) => p.mainImage.includes(mediaPrefix) || p.galleryImages.some((g) => g.includes(mediaPrefix))
    );
    const isCoreKey = ['logo', 'cover', 'flyer'].includes(target.key);

    if (isCoreKey || usedInProducts.length > 0) {
      return res.status(400).json({
        error: `No se puede eliminar esta imagen porque está en uso (${
          isCoreKey ? 'Identidad/Sección principal' : `${usedInProducts.length} producto(s)`
        }). Reemplázala primero.`,
      });
    }

    db.images = db.images.filter((i) => i.id !== req.params.id);
    saveDb(db);
    return res.json({ success: true, updatedAt: db.updatedAt });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al eliminar la imagen.' });
  }
});

// Export / Import Backup & Reset to Factory Defaults
app.get('/api/admin/backup', requireAdminAuth, noCache, (_req, res) => {
  const db = getDb();
  const safeExport = {
    ...db,
    admins: [], // Never export password hashes in content backup
  };
  res.setHeader('Content-Disposition', 'attachment; filename="personalizados-angel-backup.json"');
  res.json(safeExport);
});

app.post('/api/admin/restore', requireAdminAuth, (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || !incoming.identity || !Array.isArray(incoming.products)) {
      return res.status(400).json({ error: 'El archivo de respaldo no tiene un formato válido.' });
    }
    const currentDb = getDb();
    const restored = {
      ...currentDb,
      identity: incoming.identity,
      visual: incoming.visual || currentDb.visual,
      categories: incoming.categories || currentDb.categories,
      products: incoming.products,
      sections: incoming.sections || currentDb.sections,
      buttons: incoming.buttons || currentDb.buttons,
      images: incoming.images || currentDb.images,
      marqueeItems: incoming.marqueeItems || currentDb.marqueeItems,
      admins: currentDb.admins, // preserve current admin accounts
    };
    saveDb(restored);
    return res.json({ success: true, updatedAt: restored.updatedAt });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al restaurar la copia de seguridad.' });
  }
});

// ==========================================
// 5. ROUTES FOR /admin AND PUBLIC WEBSITE
// ==========================================
app.get(['/admin', '/admin/', '/admin.html', '/admin/index.html', '/admin/*'], noCache, (_req, res) => {
  const adminDirPath = path.join(__dirname, 'admin', 'index.html');
  const adminHtmlPath = path.join(__dirname, 'admin.html');
  if (fs.existsSync(adminDirPath)) {
    return res.sendFile(adminDirPath);
  }
  if (fs.existsSync(adminHtmlPath)) {
    return res.sendFile(adminHtmlPath);
  }
  return res.status(404).send('Panel administrativo no encontrado.');
});

app.use(
  express.static(__dirname, {
    index: false,
  })
);

app.get('*', noCache, (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Personalizados Ángel Server running on http://0.0.0.0:${PORT}`);
});
