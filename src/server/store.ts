import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const INITIAL_IMAGES_FILE = path.join(DATA_DIR, 'initial-images.json');

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  lastLogin?: string;
}

export interface BusinessIdentity {
  commercialName: string;
  titlePrefix: string;
  titleMain: string;
  subtitle: string;
  description: string;
  mainLogo: string;
  headerLogo: string;
  avatarImage: string;
  coverImage: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  whatsappColor: string;
  headingFont: string;
  bodyFont: string;
  displayFont: string;
  phone: string;
  whatsappNumber: string;
  address: string;
  city: string;
  addressNote: string;
  footerText: string;
  socialLinks: {
    instagram: string;
    facebook: string;
    tiktok: string;
    googleMaps: string;
  };
}

export interface ProductItem {
  id: string;
  name: string;
  description: string;
  price: number | null;
  consultPrice: boolean;
  priceLabel: string;
  mainImage: string;
  galleryImages: string[];
  categoryId: string;
  order: number;
  active: boolean;
  featured: boolean;
  inCarousel: boolean;
  consultButtonText: string;
  viewPhotoButtonText: string;
  whatsappMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  description: string;
  image: string;
  order: number;
  active: boolean;
}

export interface ImageAsset {
  id: string;
  key: string;
  name: string;
  category: 'logo' | 'cover' | 'product' | 'gallery' | 'banner' | 'background' | 'other';
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface PageSectionConfig {
  id: string;
  key: string;
  name: string;
  title: string;
  subtitle: string;
  description: string;
  image?: string;
  chips?: string[];
  items?: Array<{ title: string; description: string; icon?: string; image?: string }>;
  buttonText?: string;
  buttonAction?: string;
  buttonMessage?: string;
  active: boolean;
  order: number;
}

export interface ButtonLinkConfig {
  id: string;
  key: string;
  label: string;
  text: string;
  colorVariant: 'gold' | 'whatsapp' | 'outline' | 'custom';
  customBgColor?: string;
  customTextColor?: string;
  actionType: 'whatsapp' | 'url' | 'scroll' | 'modal';
  destinationUrl: string;
  whatsappNumber: string;
  defaultMessage: string;
  visible: boolean;
}

export interface VisualConfig {
  bgLight: string;
  fgLight: string;
  cardLight: string;
  lineLight: string;
  bgDark: string;
  fgDark: string;
  cardDark: string;
  lineDark: string;
  navyColor: string;
  tealColor: string;
  goldColor: string;
  waColor: string;
  themeMode: 'auto' | 'light' | 'dark';
  headingFont: string;
  bodyFont: string;
  titleSizeScale: number; // 0.85 to 1.25
  sectionSpacing: number; // 36 to 84 px
  cardBorderRadius: number; // 8 to 28 px
  cardShadowIntensity: number; // 0 to 100
  buttonBorderRadius: number; // 6 to 28 px
  backgroundImageUrl: string;
  enableSparkles: boolean;
  enableLightning: boolean;
  enable3DCarouselRotation: boolean;
  enableCardTilt: boolean;
  enableScrollAnimations: boolean;
  effectIntensity: number; // 20 to 100
}

export interface DatabaseSchema {
  version: number;
  updatedAt: string;
  admins: AdminUser[];
  identity: BusinessIdentity;
  visual: VisualConfig;
  categories: CategoryItem[];
  products: ProductItem[];
  sections: PageSectionConfig[];
  buttons: ButtonLinkConfig[];
  images: ImageAsset[];
  marqueeItems: string[];
}

function loadInitialImages(): Record<string, string> {
  try {
    if (fs.existsSync(INITIAL_IMAGES_FILE)) {
      return JSON.parse(fs.readFileSync(INITIAL_IMAGES_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read initial-images.json:', e);
  }
  return {};
}

export function createInitialDatabase(): DatabaseSchema {
  const initImgs = loadInitialImages();
  const now = new Date().toISOString();

  const imagesList: ImageAsset[] = [
    {
      id: 'img_logo',
      key: 'logo',
      name: 'Logotipo Principal Personalizados Ángel',
      category: 'logo',
      url: initImgs['logo'] || '',
      mimeType: 'image/jpeg',
      sizeBytes: (initImgs['logo'] || '').length,
      createdAt: now,
    },
    {
      id: 'img_cover',
      key: 'cover',
      name: 'Portada Principal Familia y Estilo',
      category: 'cover',
      url: initImgs['cover'] || '',
      mimeType: 'image/jpeg',
      sizeBytes: (initImgs['cover'] || '').length,
      createdAt: now,
    },
    {
      id: 'img_flyer',
      key: 'flyer',
      name: 'Banner Tipos de Mug (Clásico, Interior Color, Mágico)',
      category: 'banner',
      url: initImgs['flyer'] || '',
      mimeType: 'image/jpeg',
      sizeBytes: (initImgs['flyer'] || '').length,
      createdAt: now,
    },
    {
      id: 'img_p1',
      key: 'p1',
      name: 'Taza con plato: Mamá',
      category: 'product',
      url: initImgs['p1'] || '',
      mimeType: 'image/jpeg',
      sizeBytes: (initImgs['p1'] || '').length,
      createdAt: now,
    },
    {
      id: 'img_p2',
      key: 'p2',
      name: 'Mug interior rosado: Abuela',
      category: 'product',
      url: initImgs['p2'] || '',
      mimeType: 'image/jpeg',
      sizeBytes: (initImgs['p2'] || '').length,
      createdAt: now,
    },
    {
      id: 'img_p3',
      key: 'p3',
      name: 'Mugs a todo color: Flash',
      category: 'product',
      url: initImgs['p3'] || '',
      mimeType: 'image/jpeg',
      sizeBytes: (initImgs['p3'] || '').length,
      createdAt: now,
    },
    {
      id: 'img_p4',
      key: 'p4',
      name: 'Mug con dulces: nombre personalizado',
      category: 'product',
      url: initImgs['p4'] || '',
      mimeType: 'image/jpeg',
      sizeBytes: (initImgs['p4'] || '').length,
      createdAt: now,
    },
    {
      id: 'img_p5',
      key: 'p5',
      name: 'Mugs metalizados',
      category: 'product',
      url: initImgs['p5'] || '',
      mimeType: 'image/jpeg',
      sizeBytes: (initImgs['p5'] || '').length,
      createdAt: now,
    },
    {
      id: 'img_p6',
      key: 'p6',
      name: 'Mugs glitter',
      category: 'product',
      url: initImgs['p6'] || '',
      mimeType: 'image/jpeg',
      sizeBytes: (initImgs['p6'] || '').length,
      createdAt: now,
    },
  ];

  // If ADMIN_INITIAL_PASSWORD and ADMIN_INITIAL_USER are set in environment, seed admin
  const admins: AdminUser[] = [];
  if (process.env.ADMIN_INITIAL_PASSWORD) {
    const hash = bcrypt.hashSync(process.env.ADMIN_INITIAL_PASSWORD, 10);
    admins.push({
      id: 'admin_1',
      username: process.env.ADMIN_INITIAL_USER || 'admin',
      email: process.env.ADMIN_INITIAL_EMAIL || 'admin@personalizadosangel.com',
      passwordHash: hash,
      createdAt: now,
    });
  }

  return {
    version: 1,
    updatedAt: now,
    admins,
    identity: {
      commercialName: 'Personalizados Ángel',
      titlePrefix: 'Personalizados',
      titleMain: 'ÁNGEL',
      subtitle: 'Tu familia, tu estilo, nuestros diseños. Mugs y detalles personalizados hechos a tu medida.',
      description: 'Mugs clásicos, mágicos, metalizados, glitter y detalles personalizados con diseño exclusivo en Medellín.',
      mainLogo: '/api/media/img_logo',
      headerLogo: '/api/media/img_logo',
      avatarImage: '/api/media/img_logo',
      coverImage: '/api/media/img_cover',
      favicon: '/api/media/img_logo',
      primaryColor: '#0a1a4a',
      secondaryColor: '#5fa8c4',
      accentColor: '#f2c75c',
      whatsappColor: '#1faa59',
      headingFont: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
      bodyFont: 'Georgia, "Palatino Linotype", serif',
      displayFont: '"Cinzel", "Trajan Pro", Georgia, serif',
      phone: '318 788 8765',
      whatsappNumber: '573187888765',
      address: 'Calle 95 #47-39, Aranjuez',
      city: 'Medellín, Colombia',
      addressNote: 'Datos por verificar con el negocio.',
      footerText: '© Personalizados Ángel',
      socialLinks: {
        instagram: 'https://www.instagram.com/personalizadosangel05/',
        facebook: 'https://www.facebook.com/search/top?q=Personalizados%20Angel',
        tiktok: '',
        googleMaps: 'https://www.google.com/maps/search/?api=1&query=Calle+95+%2347-39+Aranjuez+Medell%C3%ADn+Colombia',
      },
    },
    visual: {
      bgLight: '#fff9ec',
      fgLight: '#0c1f55',
      cardLight: '#ffffff',
      lineLight: '#e8dcc0',
      bgDark: '#070f2b',
      fgDark: '#f8efd2',
      cardDark: '#101c46',
      lineDark: '#23326b',
      navyColor: '#0a1a4a',
      tealColor: '#5fa8c4',
      goldColor: '#f2c75c',
      waColor: '#1faa59',
      themeMode: 'auto',
      headingFont: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
      bodyFont: 'Georgia, "Palatino Linotype", serif',
      titleSizeScale: 1,
      sectionSpacing: 56,
      cardBorderRadius: 18,
      cardShadowIntensity: 50,
      buttonBorderRadius: 14,
      backgroundImageUrl: '',
      enableSparkles: true,
      enableLightning: true,
      enable3DCarouselRotation: true,
      enableCardTilt: true,
      enableScrollAnimations: true,
      effectIntensity: 100,
    },
    categories: [
      {
        id: 'cat_todos',
        name: 'Todos los Mugs',
        description: 'Catálogo completo de tazas y mugs personalizados.',
        image: '/api/media/img_p1',
        order: 1,
        active: true,
      },
      {
        id: 'cat_familia',
        name: 'Familia y Regalos',
        description: 'Diseños especiales para mamá, papá, abuelos y toda la familia.',
        image: '/api/media/img_p2',
        order: 2,
        active: true,
      },
      {
        id: 'cat_especiales',
        name: 'Metalizados y Glitter',
        description: 'Acabados brillantes, dorados, plateados y mágicos.',
        image: '/api/media/img_p5',
        order: 3,
        active: true,
      },
    ],
    products: [
      {
        id: 'prod_1',
        name: 'Taza con plato: Mamá',
        description: 'Taza con plato y el mensaje “Eres la mejor Mamá del Mundo”.',
        price: null,
        consultPrice: true,
        priceLabel: 'Solicita precio',
        mainImage: '/api/media/img_p1',
        galleryImages: ['/api/media/img_p1'],
        categoryId: 'cat_familia',
        order: 1,
        active: true,
        featured: true,
        inCarousel: true,
        consultButtonText: 'Consultar producto',
        viewPhotoButtonText: 'Ver foto',
        whatsappMessage: 'Hola, buenas. Vi su página web y estoy interesado en el producto {nombre}. ¿Me pueden brindar más información sobre el precio, las características y la disponibilidad? Gracias.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod_2',
        name: 'Mug interior rosado: Abuela',
        description: 'Mug blanco con interior rosado y frase para abuela.',
        price: null,
        consultPrice: true,
        priceLabel: 'Solicita precio',
        mainImage: '/api/media/img_p2',
        galleryImages: ['/api/media/img_p2'],
        categoryId: 'cat_familia',
        order: 2,
        active: true,
        featured: true,
        inCarousel: true,
        consultButtonText: 'Consultar producto',
        viewPhotoButtonText: 'Ver foto',
        whatsappMessage: 'Hola, buenas. Vi su página web y estoy interesado en el producto {nombre}. ¿Me pueden brindar más información sobre el precio, las características y la disponibilidad? Gracias.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod_3',
        name: 'Mugs a todo color: Flash',
        description: 'Mugs con diseño a todo color para papá.',
        price: null,
        consultPrice: true,
        priceLabel: 'Solicita precio',
        mainImage: '/api/media/img_p3',
        galleryImages: ['/api/media/img_p3'],
        categoryId: 'cat_familia',
        order: 3,
        active: true,
        featured: true,
        inCarousel: true,
        consultButtonText: 'Consultar producto',
        viewPhotoButtonText: 'Ver foto',
        whatsappMessage: 'Hola, buenas. Vi su página web y estoy interesado en el producto {nombre}. ¿Me pueden brindar más información sobre el precio, las características y la disponibilidad? Gracias.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod_4',
        name: 'Mug con dulces: nombre personalizado',
        description: 'Mug con nombre y detalle de dulces para regalar.',
        price: null,
        consultPrice: true,
        priceLabel: 'Solicita precio',
        mainImage: '/api/media/img_p4',
        galleryImages: ['/api/media/img_p4'],
        categoryId: 'cat_familia',
        order: 4,
        active: true,
        featured: true,
        inCarousel: true,
        consultButtonText: 'Consultar producto',
        viewPhotoButtonText: 'Ver foto',
        whatsappMessage: 'Hola, buenas. Vi su página web y estoy interesado en el producto {nombre}. ¿Me pueden brindar más información sobre el precio, las características y la disponibilidad? Gracias.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod_5',
        name: 'Mugs metalizados',
        description: 'Mugs dorados y plateados con frase de familia.',
        price: null,
        consultPrice: true,
        priceLabel: 'Solicita precio',
        mainImage: '/api/media/img_p5',
        galleryImages: ['/api/media/img_p5'],
        categoryId: 'cat_especiales',
        order: 5,
        active: true,
        featured: true,
        inCarousel: true,
        consultButtonText: 'Consultar producto',
        viewPhotoButtonText: 'Ver foto',
        whatsappMessage: 'Hola, buenas. Vi su página web y estoy interesado en el producto {nombre}. ¿Me pueden brindar más información sobre el precio, las características y la disponibilidad? Gracias.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod_6',
        name: 'Mugs glitter',
        description: 'Mugs glitter morado, plateado y dorado con frases.',
        price: null,
        consultPrice: true,
        priceLabel: 'Solicita precio',
        mainImage: '/api/media/img_p6',
        galleryImages: ['/api/media/img_p6'],
        categoryId: 'cat_especiales',
        order: 6,
        active: true,
        featured: true,
        inCarousel: true,
        consultButtonText: 'Consultar producto',
        viewPhotoButtonText: 'Ver foto',
        whatsappMessage: 'Hola, buenas. Vi su página web y estoy interesado en el producto {nombre}. ¿Me pueden brindar más información sobre el precio, las características y la disponibilidad? Gracias.',
        createdAt: now,
        updatedAt: now,
      },
    ],
    marqueeItems: [
      'Tazas',
      'Mugs',
      'Mugs a todo color',
      'Mugs metalizados',
      'Mugs glitter',
      'Mug con nombre',
      'Regalos personalizados',
    ],
    sections: [
      {
        id: 'sec_hero',
        key: 'hero',
        name: 'Encabezado y Portada Principal',
        title: 'Personalizados ÁNGEL',
        subtitle: 'Tu familia, tu estilo, nuestros diseños. Mugs y detalles personalizados hechos a tu medida.',
        description: 'Portada principal con logotipo animado, rayos en el título y tarjeta 3D.',
        image: '/api/media/img_cover',
        active: true,
        order: 1,
      },
      {
        id: 'sec_marquee',
        key: 'marquee',
        name: 'Cinta Animada (Marquesina)',
        title: 'Cinta de especialidades',
        subtitle: '',
        description: 'Franja dorada animada con las especialidades del negocio.',
        active: true,
        order: 2,
      },
      {
        id: 'sec_carousel',
        key: 'carousel',
        name: 'Galería Carrusel 3D',
        title: 'Gira y explora',
        subtitle: 'Arrastra para girar el carrusel. Toca una foto para verla grande.',
        description: 'Carrusel interactivo en 3D con fotografías de productos destacados.',
        active: true,
        order: 3,
      },
      {
        id: 'sec_catalog',
        key: 'catalog',
        name: 'Catálogo de Productos',
        title: 'Nuestro catálogo',
        subtitle: 'Toca “Consultar producto” y te abrimos WhatsApp con el mensaje listo.',
        description: 'Cuadrícula principal de productos administrables y filtro por categorías.',
        active: true,
        order: 4,
      },
      {
        id: 'sec_flyer',
        key: 'flyer',
        name: 'Sección Tipos de Mugs / Servicios',
        title: 'Mugs para cada estilo',
        subtitle: 'Clásico, interior de color y mágico. Toca la imagen para verla grande.',
        description: 'Banner informativo con los estilos de mugs disponibles y etiquetas de beneficios.',
        image: '/api/media/img_flyer',
        chips: [
          'Ideal para regalar',
          'Personaliza tus momentos',
          'Impresión de alta calidad',
          'Durables y resistentes',
        ],
        buttonText: 'Consultar por mugs',
        buttonMessage: 'Hola, buenas. Vi su página web y quiero consultar por los mugs (clásico, interior de color o mágico). ¿Me pueden brindar más información sobre el precio, las características y la disponibilidad? Gracias.',
        active: true,
        order: 5,
      },
      {
        id: 'sec_steps',
        key: 'steps',
        name: 'Pasos para realizar un pedido',
        title: '¿Cómo hacer tu pedido?',
        subtitle: 'Personalizar tu mug o regalo es muy fácil y rápido.',
        description: 'Guía paso a paso para los clientes.',
        items: [
          {
            title: '1. Elige tu estilo de Mug',
            description: 'Selecciona entre mug clásico, interior de color, mágico, metalizado o glitter.',
          },
          {
            title: '2. Envíanos tu idea o fotos',
            description: 'Escríbenos por WhatsApp con las fotos, nombres, frases o temática que deseas.',
          },
          {
            title: '3. Aprobación y Entrega',
            description: 'Preparamos el diseño a tu medida y te entregamos un detalle único y duradero.',
          },
        ],
        active: false, // conservamos la apariencia original por defecto y permitimos activarla desde el panel
        order: 6,
      },
      {
        id: 'sec_corporate',
        key: 'corporate',
        name: 'Sección para Empresas y Eventos',
        title: 'Regalos Corporativos y Eventos',
        subtitle: 'Mugs personalizados con el logo de tu empresa, recordatorios y fechas especiales.',
        description: 'Atención por mayor y detal para empresas, colegios y celebraciones.',
        buttonText: 'Cotizar pedido empresarial',
        buttonMessage: 'Hola, buenas. Quiero solicitar una cotización de mugs personalizados para empresa / evento.',
        active: false, // activable desde el panel en cualquier momento
        order: 7,
      },
      {
        id: 'sec_contact',
        key: 'contact',
        name: 'Información de Contacto y Ubicación',
        title: 'Hablemos de tu diseño',
        subtitle: 'Calle 95 #47-39, Aranjuez, Medellín, Colombia',
        description: 'Sección inferior con dirección, teléfono, redes sociales y mapa.',
        active: true,
        order: 8,
      },
      {
        id: 'sec_footer',
        key: 'footer',
        name: 'Pie de Página',
        title: '© Personalizados Ángel',
        subtitle: '',
        description: 'Texto legal y derechos reservados al final de la página.',
        active: true,
        order: 9,
      },
    ],
    buttons: [
      {
        id: 'btn_hero_consult',
        key: 'hero_primary',
        label: 'Botón Principal Portada (Dorado)',
        text: 'Consultar ahora',
        colorVariant: 'gold',
        actionType: 'whatsapp',
        destinationUrl: '',
        whatsappNumber: '573187888765',
        defaultMessage: 'Hola, buenas. Vi su página web y quiero consultar por sus productos personalizados. ¿Me pueden brindar más información? Gracias.',
        visible: true,
      },
      {
        id: 'btn_hero_wa',
        key: 'hero_secondary',
        label: 'Botón WhatsApp Portada (Verde)',
        text: 'Consultar por WhatsApp',
        colorVariant: 'whatsapp',
        actionType: 'whatsapp',
        destinationUrl: '',
        whatsappNumber: '573187888765',
        defaultMessage: 'Hola, buenas. Vi su página web y quiero consultar por sus productos personalizados. ¿Me pueden brindar más información? Gracias.',
        visible: true,
      },
      {
        id: 'btn_flyer_wa',
        key: 'flyer_cta',
        label: 'Botón Sección Tipos de Mug',
        text: 'Consultar por mugs',
        colorVariant: 'whatsapp',
        actionType: 'whatsapp',
        destinationUrl: '',
        whatsappNumber: '573187888765',
        defaultMessage: 'Hola, buenas. Vi su página web y quiero consultar por los mugs (clásico, interior de color o mágico). ¿Me pueden brindar más información sobre el precio, las características y la disponibilidad? Gracias.',
        visible: true,
      },
      {
        id: 'btn_contact_wa',
        key: 'contact_wa',
        label: 'Botón Contacto WhatsApp',
        text: 'WhatsApp',
        colorVariant: 'whatsapp',
        actionType: 'whatsapp',
        destinationUrl: '',
        whatsappNumber: '573187888765',
        defaultMessage: 'Hola, buenas. Vi su página web y quiero consultar por sus productos personalizados. ¿Me pueden brindar más información? Gracias.',
        visible: true,
      },
      {
        id: 'btn_contact_ig',
        key: 'contact_ig',
        label: 'Botón Contacto Instagram',
        text: 'Instagram',
        colorVariant: 'gold',
        actionType: 'url',
        destinationUrl: 'https://www.instagram.com/personalizadosangel05/',
        whatsappNumber: '',
        defaultMessage: '',
        visible: true,
      },
      {
        id: 'btn_contact_fb',
        key: 'contact_fb',
        label: 'Botón Contacto Facebook',
        text: 'Facebook',
        colorVariant: 'gold',
        actionType: 'url',
        destinationUrl: 'https://www.facebook.com/search/top?q=Personalizados%20Angel',
        whatsappNumber: '',
        defaultMessage: '',
        visible: true,
      },
      {
        id: 'btn_contact_maps',
        key: 'contact_maps',
        label: 'Botón Ver en Google Maps',
        text: 'Ver en Google Maps',
        colorVariant: 'outline',
        actionType: 'url',
        destinationUrl: 'https://www.google.com/maps/search/?api=1&query=Calle+95+%2347-39+Aranjuez+Medell%C3%ADn+Colombia',
        whatsappNumber: '',
        defaultMessage: '',
        visible: true,
      },
      {
        id: 'btn_fab_wa',
        key: 'fab_wa',
        label: 'Botón Flotante WhatsApp (Esquina inferior)',
        text: 'Consultar por WhatsApp',
        colorVariant: 'whatsapp',
        actionType: 'whatsapp',
        destinationUrl: '',
        whatsappNumber: '573187888765',
        defaultMessage: 'Hola, buenas. Vi su página web y quiero consultar por sus productos personalizados. ¿Me pueden brindar más información? Gracias.',
        visible: true,
      },
    ],
    images: imagesList,
  };
}

let cachedDb: DatabaseSchema | null = null;

export function getDb(): DatabaseSchema {
  if (cachedDb) return cachedDb;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      cachedDb = JSON.parse(raw) as DatabaseSchema;
      return cachedDb;
    } catch (e) {
      console.error('Error loading database.json, re-initializing:', e);
    }
  }

  cachedDb = createInitialDatabase();
  saveDb(cachedDb);
  return cachedDb;
}

export function saveDb(data: DatabaseSchema): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  data.updatedAt = new Date().toISOString();
  cachedDb = data;

  // Atomic write using temp file
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
  return cachedDb;
}
