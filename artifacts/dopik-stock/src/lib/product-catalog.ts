
export type CatalogBrand = { brand: string; models: string[] };
export type CatalogSection = { category: string; brands: CatalogBrand[] };

export const PRODUCT_CATALOG: CatalogSection[] = [
  {
    category: "Smartphone",
    brands: [
      {
        brand: "Apple",
        models: [
          "iPhone SE (1st gen)", "iPhone 7", "iPhone 7 Plus", "iPhone 8", "iPhone 8 Plus",
          "iPhone X", "iPhone XS", "iPhone XS Max", "iPhone XR",
          "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max",
          "iPhone SE (2nd gen)",
          "iPhone 12 mini", "iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max",
          "iPhone 13 mini", "iPhone 13", "iPhone 13 Pro", "iPhone 13 Pro Max",
          "iPhone SE (3rd gen)",
          "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max",
          "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max",
          "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max", "iPhone 16e",
          "iPhone 17", "iPhone 17 Air", "iPhone 17 Pro", "iPhone 17 Pro Max", "iPhone 17e",
        ],
      },
      {
        brand: "Samsung",
        models: [
          "Galaxy S7", "Galaxy S7 Edge", "Galaxy S8", "Galaxy S8+", "Galaxy S9", "Galaxy S9+",
          "Galaxy S10e", "Galaxy S10", "Galaxy S10+",
          "Galaxy S20", "Galaxy S20+", "Galaxy S20 Ultra",
          "Galaxy S21", "Galaxy S21+", "Galaxy S21 Ultra",
          "Galaxy S22", "Galaxy S22+", "Galaxy S22 Ultra",
          "Galaxy S23", "Galaxy S23+", "Galaxy S23 Ultra",
          "Galaxy S24", "Galaxy S24+", "Galaxy S24 Ultra",
          "Galaxy S25", "Galaxy S25+", "Galaxy S25 Ultra",
          "Galaxy S26", "Galaxy S26+", "Galaxy S26 Ultra",
          "Galaxy Note 7", "Galaxy Note 8", "Galaxy Note 9", "Galaxy Note 10", "Galaxy Note 10+",
          "Galaxy Note 20", "Galaxy Note 20 Ultra",
          "Galaxy Z Fold", "Galaxy Z Fold 2", "Galaxy Z Fold 3", "Galaxy Z Fold 4",
          "Galaxy Z Fold 5", "Galaxy Z Fold 6", "Galaxy Z Fold 7",
          "Galaxy Z Flip", "Galaxy Z Flip 3", "Galaxy Z Flip 4",
          "Galaxy Z Flip 5", "Galaxy Z Flip 6", "Galaxy Z Flip 7",
          "Galaxy A3", "Galaxy A5", "Galaxy A7", "Galaxy A8", "Galaxy A9",
          "Galaxy A10", "Galaxy A20", "Galaxy A30", "Galaxy A50",
          "Galaxy A51", "Galaxy A52", "Galaxy A53", "Galaxy A54", "Galaxy A55", "Galaxy A56",
          "Galaxy A71", "Galaxy A72", "Galaxy A73",
          "Galaxy M12", "Galaxy M13", "Galaxy M14", "Galaxy M15", "Galaxy M17e",
          "Galaxy M32", "Galaxy M33", "Galaxy M34", "Galaxy M52", "Galaxy M53",
        ],
      },
      {
        brand: "Google",
        models: [
          "Pixel 2", "Pixel 2 XL", "Pixel 3", "Pixel 3 XL", "Pixel 3a", "Pixel 3a XL",
          "Pixel 4", "Pixel 4 XL", "Pixel 4a", "Pixel 4a 5G",
          "Pixel 5", "Pixel 5a",
          "Pixel 6", "Pixel 6 Pro", "Pixel 6a",
          "Pixel 7", "Pixel 7 Pro", "Pixel 7a",
          "Pixel 8", "Pixel 8 Pro", "Pixel 8a",
          "Pixel 9", "Pixel 9 Pro", "Pixel 9 Pro XL", "Pixel 9 Pro Fold", "Pixel 9a",
        ],
      },
      {
        brand: "OnePlus",
        models: [
          "OnePlus 6", "OnePlus 6T", "OnePlus 7", "OnePlus 7 Pro",
          "OnePlus 8", "OnePlus 8 Pro", "OnePlus 9", "OnePlus 9 Pro",
          "OnePlus 10 Pro", "OnePlus 11", "OnePlus 12", "OnePlus 13",
          "OnePlus Nord", "OnePlus Nord 2", "OnePlus Nord 3",
        ],
      },
      {
        brand: "Xiaomi",
        models: [
          "Xiaomi 12", "Xiaomi 12 Pro", "Xiaomi 13", "Xiaomi 13 Pro",
          "Xiaomi 14", "Xiaomi 14 Ultra",
          "Redmi Note 10", "Redmi Note 11", "Redmi Note 12", "Redmi Note 13",
          "Redmi A1", "Redmi A2", "Redmi A3",
          "POCO X3", "POCO X4", "POCO X5", "POCO X6",
          "POCO F3", "POCO F4", "POCO F5",
        ],
      },
      {
        brand: "Sony",
        models: [
          "Xperia 1", "Xperia 1 II", "Xperia 1 III", "Xperia 1 IV", "Xperia 1 V", "Xperia 1 VI",
          "Xperia 5", "Xperia 5 II", "Xperia 5 III", "Xperia 5 IV", "Xperia 5 V",
          "Xperia 10", "Xperia 10 II", "Xperia 10 III", "Xperia 10 IV", "Xperia 10 V",
        ],
      },
    ],
  },
  {
    category: "Laptop",
    brands: [
      {
        brand: "Apple",
        models: [
          "MacBook (12-inch)",
          "MacBook Pro 13-inch (no Touch Bar)", "MacBook Pro 13-inch (Touch Bar)",
          "MacBook Pro 15-inch", "MacBook Pro 16-inch",
          "MacBook Air (Retina)",
          "MacBook Air (M1)", "MacBook Pro 13-inch (M1)",
          "MacBook Pro 14-inch (M1 Pro/Max)", "MacBook Pro 16-inch (M1 Pro/Max)",
          "MacBook Air (M2)", "MacBook Pro 13-inch (M2)",
          "MacBook Pro 14-inch (M2 Pro/Max)", "MacBook Pro 16-inch (M2 Pro/Max)",
          "MacBook Air 13-inch (M3)", "MacBook Air 15-inch (M3)",
          "MacBook Pro 14-inch (M3/Pro/Max)", "MacBook Pro 16-inch (M3 Pro/Max)",
          "MacBook Air 13-inch (M5)", "MacBook Air 15-inch (M5)",
          "MacBook Pro 14-inch (M5/Pro/Max)", "MacBook Pro 16-inch (M5 Pro/Max)",
          "MacBook Neo",
        ],
      },
      {
        brand: "HP",
        models: [
          "HP Pavilion 14", "HP Pavilion 15", "HP Pavilion 17", "HP Pavilion x360", "HP Pavilion Aero 13",
          "HP Envy 13", "HP Envy 14", "HP Envy 15", "HP Envy 17",
          "HP Envy x360 13", "HP Envy x360 15",
          "HP Spectre x360 13", "HP Spectre x360 14", "HP Spectre x360 15",
          "HP OmniBook Ultra", "HP OmniBook X", "HP OmniBook 7", "HP OmniBook 5", "HP OmniBook 3",
          "HP OMEN 15", "HP OMEN 16", "HP OMEN 17", "HP OMEN Transcend 14",
          "HP Victus 15", "HP Victus 16",
          "HP EliteBook 830", "HP EliteBook 840", "HP EliteBook 850", "HP EliteBook 860",
          "HP EliteBook 1040", "HP EliteBook x360", "HP EliteBook Ultra",
          "HP ProBook 430", "HP ProBook 440", "HP ProBook 450", "HP ProBook 455", "HP ProBook 470",
          "HP Elite Dragonfly", "HP Elite Dragonfly G2", "HP Elite Dragonfly G3", "HP Elite Dragonfly G4",
          "HP ZBook Firefly 14", "HP ZBook Fury 15", "HP ZBook Studio",
          "HP Stream 11", "HP Stream 14", "HP Chromebook 14", "HP Chromebook x360",
        ],
      },
      {
        brand: "Dell",
        models: [
          "Dell Inspiron 14", "Dell Inspiron 15", "Dell Inspiron 16",
          "Dell Inspiron 14 2-in-1", "Dell Inspiron 15 2-in-1",
          "Dell XPS 13", "Dell XPS 15", "Dell XPS 17",
          "Dell 13", "Dell 14", "Dell 15", "Dell 16 Premium", "Dell 16",
          "Dell Alienware m15", "Dell Alienware m16", "Dell Alienware m17",
          "Dell Alienware x14", "Dell Alienware x15", "Dell Alienware x16", "Dell Alienware Area-51m",
          "Dell G15", "Dell G16",
          "Dell Latitude 5000", "Dell Latitude 7000", "Dell Latitude 9000",
          "Dell Vostro 3000", "Dell Vostro 5000",
          "Dell Precision 3000", "Dell Precision 5000", "Dell Precision 7000",
          "Dell Pro 13", "Dell Pro 14", "Dell Pro 16", "Dell Pro Max 14", "Dell Pro Max 16",
        ],
      },
      {
        brand: "Lenovo",
        models: [
          "ThinkPad X1 Carbon", "ThinkPad X1 Extreme", "ThinkPad X1 Nano", "ThinkPad X1 Fold",
          "ThinkPad X13", "ThinkPad T14", "ThinkPad T14s", "ThinkPad T16",
          "ThinkPad L14", "ThinkPad L15", "ThinkPad E14", "ThinkPad E15",
          "ThinkBook 13s", "ThinkBook 14", "ThinkBook 15", "ThinkBook 16p",
          "IdeaPad 1", "IdeaPad 3", "IdeaPad 5", "IdeaPad 7",
          "IdeaPad Flex 5", "IdeaPad Gaming 3", "IdeaPad Gaming 5",
          "Yoga 6", "Yoga 7i", "Yoga 9i", "Yoga Book 9i", "Yoga Slim 7", "Yoga Slim 9",
          "Legion 5", "Legion 5 Pro", "Legion 7", "Legion 7i",
          "Legion Pro 5", "Legion Pro 7",
        ],
      },
      {
        brand: "ASUS",
        models: [
          "ASUS ZenBook 13", "ASUS ZenBook 14", "ASUS ZenBook 15", "ASUS ZenBook Pro Duo",
          "ASUS VivoBook 15", "ASUS VivoBook 16", "ASUS VivoBook 17",
          "ASUS ProArt Studiobook",
          "ASUS ROG Zephyrus G14", "ASUS ROG Zephyrus G15", "ASUS ROG Zephyrus G16",
          "ASUS ROG Strix G15", "ASUS ROG Strix G17",
          "ASUS TUF Gaming A15", "ASUS TUF Gaming A16", "ASUS TUF Gaming F15", "ASUS TUF Gaming F17",
          "ASUS ExpertBook B1", "ASUS ExpertBook B9",
          "ASUS Chromebook",
        ],
      },
      {
        brand: "Acer",
        models: [
          "Acer Aspire 3", "Acer Aspire 5", "Acer Aspire 7",
          "Acer Swift 3", "Acer Swift 5", "Acer Swift X",
          "Acer Spin 3", "Acer Spin 5",
          "Acer Predator Helios 300", "Acer Predator Helios 500",
          "Acer Predator Triton 300", "Acer Predator Triton 500",
          "Acer Nitro 5", "Acer Nitro 16",
          "Acer ConceptD 3", "Acer ConceptD 5",
          "Acer Chromebook",
        ],
      },
      {
        brand: "Microsoft",
        models: [
          "Surface Laptop 3", "Surface Laptop 4", "Surface Laptop 5", "Surface Laptop 6", "Surface Laptop 7",
          "Surface Laptop Go", "Surface Laptop Go 2", "Surface Laptop Go 3",
          "Surface Laptop Studio", "Surface Laptop Studio 2",
          "Surface Book 2", "Surface Book 3",
          "Surface Pro X",
        ],
      },
      {
        brand: "Razer",
        models: [
          "Razer Blade 14", "Razer Blade 15", "Razer Blade 16", "Razer Blade 18",
          "Razer Blade Stealth",
        ],
      },
    ],
  },
  {
    category: "Tablet",
    brands: [
      {
        brand: "Apple",
        models: [
          "iPad Pro 9.7-inch",
          "iPad Pro 12.9-inch (2nd gen)", "iPad Pro 10.5-inch",
          "iPad (5th gen)", "iPad (6th gen)", "iPad (7th gen)", "iPad (8th gen)",
          "iPad (9th gen)", "iPad (10th gen)",
          "iPad Pro 11-inch (1st gen)", "iPad Pro 11-inch (2nd gen)",
          "iPad Pro 11-inch (3rd gen)", "iPad Pro 11-inch (4th gen, M2)",
          "iPad Pro 11-inch (M4, OLED)",
          "iPad Pro 12.9-inch (3rd gen)", "iPad Pro 12.9-inch (4th gen)",
          "iPad Pro 12.9-inch (5th gen, mini-LED)", "iPad Pro 12.9-inch (6th gen, M2)",
          "iPad Pro 13-inch (M4, OLED)",
          "iPad mini (5th gen)", "iPad mini (6th gen)", "iPad mini (7th gen, A17 Pro)",
          "iPad Air (3rd gen)", "iPad Air (4th gen)", "iPad Air (5th gen, M1)",
          "iPad Air 11-inch (M2)", "iPad Air 13-inch (M2)",
          "iPad Air 11-inch (M4)", "iPad Air 13-inch (M4)",
        ],
      },
      {
        brand: "Microsoft",
        models: [
          "Surface Pro 7", "Surface Pro 8", "Surface Pro 9", "Surface Pro 10", "Surface Pro 11",
          "Surface Go 2", "Surface Go 3", "Surface Go 4",
          "Surface Studio 2", "Surface Studio 2+",
        ],
      },
      {
        brand: "Samsung",
        models: [
          "Galaxy Tab S7", "Galaxy Tab S7+", "Galaxy Tab S8", "Galaxy Tab S8+", "Galaxy Tab S8 Ultra",
          "Galaxy Tab S9", "Galaxy Tab S9+", "Galaxy Tab S9 Ultra",
          "Galaxy Tab A7", "Galaxy Tab A8", "Galaxy Tab A9",
        ],
      },
    ],
  },
  {
    category: "Smartwatches",
    brands: [
      {
        brand: "Apple",
        models: [
          "Apple Watch Series 1", "Apple Watch Series 2", "Apple Watch Series 3",
          "Apple Watch Series 4", "Apple Watch Series 5",
          "Apple Watch SE (1st gen)", "Apple Watch Series 6",
          "Apple Watch Series 7", "Apple Watch Series 8",
          "Apple Watch SE (2nd gen)", "Apple Watch Ultra",
          "Apple Watch Series 9", "Apple Watch Ultra 2",
          "Apple Watch Series 10",
          "Apple Watch SE (3rd gen)", "Apple Watch Series 11", "Apple Watch Ultra 3",
        ],
      },
      {
        brand: "Samsung",
        models: [
          "Samsung Galaxy Watch", "Samsung Galaxy Watch 3",
          "Samsung Galaxy Watch 4", "Samsung Galaxy Watch 5",
          "Samsung Galaxy Watch 6", "Samsung Galaxy Watch 7", "Samsung Galaxy Watch Ultra",
        ],
      },
      {
        brand: "Garmin",
        models: [
          "Garmin Fenix 6", "Garmin Fenix 7", "Garmin Fenix 8",
          "Garmin Forerunner 245", "Garmin Forerunner 255", "Garmin Forerunner 745", "Garmin Forerunner 945",
        ],
      },
      {
        brand: "Google",
        models: [
          "Google Pixel Watch", "Google Pixel Watch 2", "Google Pixel Watch 3",
        ],
      },
      {
        brand: "Fitbit",
        models: [
          "Fitbit Sense", "Fitbit Sense 2", "Fitbit Versa 3", "Fitbit Versa 4",
        ],
      },
    ],
  },
  {
    category: "Audio",
    brands: [
      {
        brand: "Apple",
        models: [
          "AirPods (1st gen)", "AirPods (2nd gen)", "AirPods (3rd gen)", "AirPods (4th gen)",
          "AirPods (4th gen with ANC)",
          "AirPods Pro (1st gen)", "AirPods Pro (2nd gen)", "AirPods Pro (3rd gen)",
          "AirPods Max (1st gen)", "AirPods Max (2nd gen)",
        ],
      },
      {
        brand: "Beats",
        models: [
          "Beats Studio Pro", "Beats Fit Pro", "Beats Flex",
          "Beats Studio Buds", "Beats Studio Buds+",
          "Beats PowerBeats Pro",
        ],
      },
      {
        brand: "Samsung",
        models: [
          "Samsung Galaxy Buds", "Samsung Galaxy Buds+",
          "Samsung Galaxy Buds Pro", "Samsung Galaxy Buds 2", "Samsung Galaxy Buds 2 Pro",
          "Samsung Galaxy Buds 3", "Samsung Galaxy Buds 3 Pro",
        ],
      },
      {
        brand: "Sony",
        models: [
          "Sony WH-1000XM3", "Sony WH-1000XM4", "Sony WH-1000XM5",
          "Sony WF-1000XM4", "Sony WF-1000XM5",
          "Sony WH-CH720N",
        ],
      },
      {
        brand: "Bose",
        models: [
          "Bose QuietComfort 35 II", "Bose QuietComfort 45", "Bose QuietComfort Ultra",
          "Bose QuietComfort Earbuds", "Bose QuietComfort Earbuds II", "Bose QuietComfort Earbuds Ultra",
        ],
      },
      {
        brand: "Jabra",
        models: [
          "Jabra Elite 4", "Jabra Elite 5", "Jabra Elite 7 Pro",
          "Jabra Elite 85h", "Jabra Evolve2",
        ],
      },
    ],
  },
  {
    category: "Phone Accessories",
    brands: [
      {
        brand: "Apple",
        models: [
          "Apple Pencil (1st gen)", "Apple Pencil (2nd gen)", "Apple Pencil (USB-C)", "Apple Pencil Pro",
          "MagSafe Charger", "MagSafe Battery Pack", "MagSafe Duo Charger",
          "iPhone Leather Case", "iPhone Silicone Case", "iPhone Clear Case", "iPhone FineWoven Case",
          "AirTag", "AirTag (2nd gen)",
        ],
      },
      {
        brand: "Generic",
        models: [
          "Phone Case", "Screen Protector (Tempered Glass)", "Phone Stand",
          "Charging Cable (USB-C)", "Charging Cable (Lightning)", "Fast Charger",
          "Power Bank", "Car Phone Holder", "Wireless Charger",
          "Phone Grip / PopSocket",
        ],
      },
      {
        brand: "Spigen",
        models: ["Spigen Tough Armor", "Spigen Ultra Hybrid", "Spigen Liquid Air"],
      },
      {
        brand: "Anker",
        models: [
          "Anker PowerCore 10000", "Anker PowerCore 20000",
          "Anker Nano Charger", "Anker 737 Power Bank",
          "Anker USB-C Hub",
        ],
      },
    ],
  },
  {
    category: "Laptop Accessories",
    brands: [
      {
        brand: "Apple",
        models: [
          "Magic Keyboard", "Magic Keyboard with Touch ID",
          "Magic Keyboard with Touch ID and Numeric Keypad",
          "Magic Mouse", "Magic Trackpad",
          "Studio Display", "Studio Display XDR", "Pro Display XDR",
          "USB-C to MagSafe 3 Cable", "Thunderbolt 4 Pro Cable",
          "USB-C Digital AV Multiport Adapter",
          "MacBook Leather Sleeve",
          "Apple Vision Pro",
        ],
      },
      {
        brand: "Logitech",
        models: [
          "Logitech MX Keys", "Logitech MX Master 3", "Logitech MX Master 3S",
          "Logitech G Pro Wireless",
          "Logitech C920", "Logitech Brio 4K",
        ],
      },
      {
        brand: "CalDigit",
        models: ["CalDigit TS4 Thunderbolt Dock"],
      },
      {
        brand: "Belkin",
        models: ["Belkin USB-C Hub", "Belkin MagSafe Charger"],
      },
      {
        brand: "Generic",
        models: [
          "Laptop Sleeve", "Laptop Backpack", "USB Hub",
          "HDMI Adapter", "USB-C to HDMI Cable",
          "External SSD", "External HDD",
          "Laptop Stand", "Laptop Cooling Pad",
          "Wireless Mouse", "Bluetooth Keyboard",
        ],
      },
      {
        brand: "Samsung",
        models: ["Samsung T7 Portable SSD", "Samsung T5 Portable SSD", "Samsung T7 Shield"],
      },
      {
        brand: "WD",
        models: ["WD My Passport", "WD Elements", "WD My Cloud"],
      },
      {
        brand: "Seagate",
        models: ["Seagate Backup Plus", "Seagate Portable HDD"],
      },
    ],
  },
  {
    category: "Cameras",
    brands: [
      {
        brand: "Canon",
        models: [
          "Canon EOS R50", "Canon EOS R8", "Canon EOS R6 Mark II", "Canon EOS R5",
          "Canon EOS 90D", "Canon PowerShot V10",
        ],
      },
      {
        brand: "Sony",
        models: [
          "Sony Alpha a7 IV", "Sony Alpha a7C II", "Sony Alpha a6700",
          "Sony ZV-E10", "Sony ZV-1 II",
        ],
      },
      {
        brand: "Fujifilm",
        models: ["Fujifilm X-T5", "Fujifilm X-S20", "Fujifilm X100VI"],
      },
      {
        brand: "GoPro",
        models: ["GoPro Hero 11", "GoPro Hero 12", "GoPro Hero 13"],
      },
    ],
  },
  {
    category: "Gaming",
    brands: [
      {
        brand: "Sony",
        models: [
          "PlayStation 4", "PlayStation 4 Pro",
          "PlayStation 5", "PlayStation 5 Digital Edition",
        ],
      },
      {
        brand: "Microsoft",
        models: [
          "Xbox One", "Xbox One X",
          "Xbox Series S", "Xbox Series X",
        ],
      },
      {
        brand: "Nintendo",
        models: ["Nintendo Switch", "Nintendo Switch Lite", "Nintendo Switch OLED"],
      },
    ],
  },
  {
    category: "Others",
    brands: [
      {
        brand: "Generic",
        models: [
          "Smart TV", "Projector", "Router (Wi-Fi)", "Network Switch",
          "Drone", "E-Reader", "Portable Speaker",
        ],
      },
    ],
  },
];

export function getCatalogForCategory(category: string): string[] {
  const section = PRODUCT_CATALOG.find(s => s.category === category);
  if (!section) return [];
  return section.brands.flatMap(b =>
    b.models.map(m => {
      const needsBrandPrefix = b.brand !== "Apple" && b.brand !== "Generic";
      return needsBrandPrefix ? `${b.brand} ${m}` : m;
    })
  );
}

export function searchCatalog(category: string, query: string): string[] {
  const all = getCatalogForCategory(category);
  if (!query.trim()) return all;
  const q = query.toLowerCase();
  return all.filter(m => m.toLowerCase().includes(q));
}
