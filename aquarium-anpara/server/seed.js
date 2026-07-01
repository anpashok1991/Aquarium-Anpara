require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('./database');
const bcrypt = require('bcryptjs');

console.log('Seeding database...');

const adminPass = bcrypt.hashSync('admin123', 10);
db.prepare(`INSERT OR IGNORE INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)`).run('Admin', 'admin@aquariumanpara.com', '9999999999', adminPass, 'admin');

const customerPass = bcrypt.hashSync('customer123', 10);
db.prepare(`INSERT OR IGNORE INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)`).run('Rahul Kumar', 'rahul@test.com', '8888888888', customerPass, 'customer');
db.prepare(`INSERT OR IGNORE INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)`).run('Priya Singh', 'priya@test.com', '7777777777', customerPass, 'customer');

db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('shop_name', 'Aquarium Anpara');
db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('shop_phone', '+91 98765 43210');
db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('shop_email', 'info@aquariumanpara.com');
db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('shop_address', 'Aquarium Anpara, Main Road, Anpara, India');
db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('whatsapp_number', '919876543210');
db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('shop_logo', '/images/logo.png');
db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('min_order_free_delivery', '500');
db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('delivery_charge', '50');

const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)');
const cats = [
  ['Aquarium', 'aquarium', 'Complete aquarium supplies', 1],
  ['Dogs', 'dogs', 'All dog breeds and supplies', 2],
  ['Cats', 'cats', 'Cat breeds and accessories', 3],
  ['Birds', 'birds', 'Bird species and cages', 4],
  ['Fish Foods', 'fish-foods', 'Premium fish food', 5],
  ['Dog Foods', 'dog-foods', 'Quality dog food', 6],
  ['Cat Foods', 'cat-foods', 'Nutritious cat food', 7],
  ['Bird Foods', 'bird-foods', 'Bird feed and treats', 8],
  ['Accessories', 'accessories', 'Pet accessories', 9],
  ['Medicines', 'medicines', 'Pet health medicines', 10],
  ['Decorations', 'decorations', 'Aquarium decorations', 11],
  ['Plants', 'plants', 'Aquarium plants', 12],
  ['Aquarium Equipment', 'aquarium-equipment', 'Filters, pumps, lights', 13],
];
cats.forEach(c => insertCat.run(...c));

const insertSubcat = db.prepare('INSERT OR IGNORE INTO categories (name, slug, description, parent_id, sort_order) VALUES (?, ?, ?, ?, ?)');
const aquariumId = db.prepare('SELECT id FROM categories WHERE slug = ?').get('aquarium')?.id;
if (aquariumId) {
  insertSubcat.run('Imported Fishes', 'imported-fishes', 'Premium imported aquarium fishes', aquariumId, 1);
  insertSubcat.run('Freshwater Fishes', 'freshwater-fishes', 'Freshwater aquarium fishes', aquariumId, 2);
  insertSubcat.run('Marine Fishes', 'marine-fishes', 'Saltwater marine fishes', aquariumId, 3);
  insertSubcat.run('Tanks', 'tanks', 'Aquarium tanks and setups', aquariumId, 4);
}
const dogsId = db.prepare('SELECT id FROM categories WHERE slug = ?').get('dogs')?.id;
if (dogsId) {
  insertSubcat.run('Imported Dog Breeds', 'imported-dog-breeds', 'Premium imported dog breeds', dogsId, 1);
  insertSubcat.run('Indian Dog Breeds', 'indian-dog-breeds', 'Indian native dog breeds', dogsId, 2);
}
const equipId = db.prepare('SELECT id FROM categories WHERE slug = ?').get('aquarium-equipment')?.id;
if (equipId) {
  insertSubcat.run('Filters', 'filters', 'Aquarium filters', equipId, 1);
  insertSubcat.run('Pumps', 'pumps', 'Aquarium pumps', equipId, 2);
  insertSubcat.run('Lights', 'lights', 'Aquarium lights', equipId, 3);
}

const insertBrand = db.prepare('INSERT OR IGNORE INTO brands (name, slug, description) VALUES (?, ?, ?)');
[['Fluval', 'fluval', 'Premium aquarium equipment'], ['Tetra', 'tetra', 'Quality fish foods'], ['Drools', 'drools', 'Indian pet food brand'], ['Pedigree', 'pedigree', 'World famous dog food'], ['Whiskas', 'whiskas', 'Cat food brand'], ['Hikari', 'hikari', 'Japanese fish food'], ['Sera', 'sera', 'German aquarium brand'], ['Royal Canin', 'royal-canin', 'Premium pet nutrition']].forEach(b => insertBrand.run(...b));

const insertProduct = db.prepare(`INSERT OR IGNORE INTO products (name, slug, description, short_description, price, discount_price, cost_price, category_id, brand_id, stock_quantity, is_featured, is_best_seller, is_new_arrival, rating, review_count, sold_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const importFishCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('imported-fishes')?.id;
const freshFishCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('freshwater-fishes')?.id;
const tanksCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('tanks')?.id;
const fishFoodCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('fish-foods')?.id;
const dogFoodCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('dog-foods')?.id;
const importedDogCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('imported-dog-breeds')?.id;
const catsCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('cats')?.id;
const birdsCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('birds')?.id;
const catFoodCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('cat-foods')?.id;
const plantsCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('plants')?.id;
const decorCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('decorations')?.id;
const accessoriesCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('accessories')?.id;
const filterCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('filters')?.id;
const medicineCat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('medicines')?.id;

const fluvalId = db.prepare('SELECT id FROM brands WHERE slug = ?').get('fluval')?.id;
const tetraId = db.prepare('SELECT id FROM brands WHERE slug = ?').get('tetra')?.id;
const droolsId = db.prepare('SELECT id FROM brands WHERE slug = ?').get('drools')?.id;
const pedigreeId = db.prepare('SELECT id FROM brands WHERE slug = ?').get('pedigree')?.id;
const whiskasId = db.prepare('SELECT id FROM brands WHERE slug = ?').get('whiskas')?.id;
const hikariId = db.prepare('SELECT id FROM brands WHERE slug = ?').get('hikari')?.id;
const seraId = db.prepare('SELECT id FROM brands WHERE slug = ?').get('sera')?.id;
const royalCaninId = db.prepare('SELECT id FROM brands WHERE slug = ?').get('royal-canin')?.id;

const products = [
  ['Red Eye Red Parrot Fish', 'red-eye-red-parrot-fish', 'Beautiful Red Eye Red Parrot Fish for your aquarium. Vibrant color, active swimmer.', 'Vibrant red parrot fish', 450, 399, 250, importFishCat, null, 25, 1, 1, 1, 4.5, 12, 45],
  ['Blue Gold Macaw Parrot', 'blue-gold-macaw', 'Stunning Blue & Gold Macaw. Hand-raised, friendly, and healthy.', 'Premium imported parrot', 25000, 22999, 18000, birdsCat, null, 3, 1, 1, 0, 4.8, 5, 8],
  ['Golden Retriever Puppy', 'golden-retriever-puppy', 'Pure breed Golden Retriever puppy. Vaccinated and health certified.', 'Friendly & loyal breed', 15000, 13999, 10000, importedDogCat, null, 5, 1, 1, 0, 4.7, 8, 12],
  ['German Shepherd Puppy', 'german-shepherd-puppy', 'Strong and intelligent German Shepherd. Fully vaccinated.', 'Guard dog breed', 18000, 16999, 12000, importedDogCat, null, 4, 1, 0, 1, 4.6, 6, 10],
  ['Persian Cat Kitten', 'persian-cat-kitten', 'Adorable Persian cat kitten. Fluffy coat, gentle nature.', 'Luxury pet cat', 8000, 7499, 5000, catsCat, null, 6, 1, 1, 0, 4.4, 9, 15],
  ['Drools Ocean Fish Adult Dog Food 3kg', 'drools-ocean-fish-dog-food', 'Premium ocean fish recipe for adult dogs. Rich in omega fatty acids.', 'Nutritious dog food', 650, 599, 400, dogFoodCat, droolsId, 50, 1, 1, 0, 4.3, 20, 80],
  ['Pedigree Adult Dog Food 10kg', 'pedigree-adult-dog-food', 'Complete nutrition for adult dogs. Trusted brand worldwide.', 'Best-selling dog food', 1200, 1099, 800, dogFoodCat, pedigreeId, 40, 1, 1, 0, 4.2, 25, 120],
  ['Whiskas Adult Cat Food 1.2kg', 'whiskas-cat-food', 'Delicious cat food with real chicken. Cats love the taste.', 'Tasty cat food', 350, 319, 200, catFoodCat, whiskasId, 35, 0, 1, 0, 4.1, 15, 65],
  ['Fluval 307 Performance Canister Filter', 'fluval-307-filter', 'Advanced 3-stage filtration for aquariums up to 700L. Whisper-quiet operation.', 'Professional aquarium filter', 8500, 7999, 5500, filterCat, fluvalId, 10, 1, 0, 1, 4.7, 8, 20],
  ['TetraMin Tropical Fish Flakes 250ml', 'tetra-min-flakes', 'Premium tropical fish food. Enhances color and vitality.', 'Quality fish food', 280, 249, 150, fishFoodCat, tetraId, 60, 0, 1, 0, 4.3, 30, 150],
  ['Hikari Gold Fish Food Pellets', 'hikari-gold-fish-food', 'Japanese quality fish food for goldfish. Floating pellets.', 'Premium fish food', 450, 399, 280, fishFoodCat, hikariId, 30, 1, 0, 1, 4.5, 18, 40],
  ['Sera Aquatan Water Conditioner', 'sera-aquatan', 'Makes tap water safe for fish. Removes chlorine and heavy metals.', 'Essential aquarium treatment', 320, 299, 180, medicineCat, seraId, 25, 0, 0, 0, 4.4, 12, 35],
  ['5 Gallon Nano Aquarium Tank', 'nano-aquarium-tank-5g', 'Compact desktop aquarium with LED light. Perfect for beginners.', 'Starter aquarium kit', 3500, 3199, 2200, tanksCat, null, 15, 1, 1, 1, 4.3, 10, 25],
  ['20 Gallon Rectangle Aquarium Tank', 'aquarium-tank-20g', 'Spacious rectangular tank with strong glass. Great for community fish.', 'Large aquarium tank', 8000, 7499, 5000, tanksCat, null, 8, 1, 0, 0, 4.5, 7, 18],
  ['Live Amazon Sword Plant', 'amazon-sword-plant', 'Beautiful live aquarium plant. Easy to care, oxygenates water naturally.', 'Live aquarium plant', 150, 129, 60, plantsCat, null, 40, 0, 0, 1, 4.2, 22, 90],
  ['Ceramic Castle Aquarium Decoration', 'ceramic-castle-decor', 'Detailed ceramic castle for aquarium decoration. Fish-friendly.', 'Aquarium decor', 550, 499, 300, decorCat, null, 20, 0, 1, 0, 4.1, 14, 55],
  ['Adjustable Aquarium Air Pump', 'aquarium-air-pump', 'Quiet adjustable air pump for aquariums. Energy efficient.', 'Essential aquarium equipment', 600, 549, 350, equipId, null, 18, 1, 0, 0, 4.3, 16, 42],
  ['LED Aquarium Light 60cm', 'led-aquarium-light-60cm', 'Slim LED light for planted aquariums. Multiple color modes.', 'Aquarium LED light', 1800, 1649, 1100, equipId, null, 12, 1, 1, 1, 4.6, 9, 28],
  ['Labrador Retriever Puppy', 'labrador-retriever-puppy', 'Active and playful Labrador puppy. Health guaranteed.', 'Family dog breed', 12000, 10999, 8000, importedDogCat, null, 6, 1, 0, 1, 4.7, 11, 22],
  ['Rabbit Hutch Wooden Cage', 'rabbit-hutch-wooden', 'Spacious wooden rabbit hutch. Weather-resistant, comfortable.', 'Pet housing', 4500, 4199, 2800, accessoriesCat, null, 8, 0, 0, 1, 4.2, 5, 12],
];

const insertImages = db.prepare('INSERT OR IGNORE INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (?, ?, ?, ?)');

products.forEach((p, i) => {
  try {
    const result = insertProduct.run(...p);
    const pid = result.lastInsertRowid;
    if (pid) {
      insertImages.run(pid, `/images/products/${i+1}.jpg`, 1, 0);
      insertImages.run(pid, `/images/products/${i+1}_b.jpg`, 0, 1);
    }
  } catch (e) {}
});

// Coupons
db.prepare('INSERT OR IGNORE INTO coupons (code, description, discount_type, discount_value, min_order, is_active) VALUES (?, ?, ?, ?, ?, ?)').run('WELCOME10', 'Welcome discount 10%', 'percentage', 10, 200, 1);
db.prepare('INSERT OR IGNORE INTO coupons (code, description, discount_type, discount_value, min_order, is_active) VALUES (?, ?, ?, ?, ?, ?)').run('FLAT100', 'Flat ₹100 off', 'fixed', 100, 500, 1);
db.prepare('INSERT OR IGNORE INTO coupons (code, description, discount_type, discount_value, min_order, is_active) VALUES (?, ?, ?, ?, ?, ?)').run('FISH20', 'Fish special 20% off', 'percentage', 20, 300, 1);

// Sample reviews
db.prepare('INSERT OR IGNORE INTO reviews (product_id, user_id, customer_name, rating, title, comment, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 2, 'Rahul Kumar', 5, 'Beautiful fish!', 'Very healthy and active fish. Great quality from Aquarium Anpara.', 1);
db.prepare('INSERT OR IGNORE INTO reviews (product_id, user_id, customer_name, rating, title, comment, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)').run(6, 2, 'Rahul Kumar', 4, 'Good quality food', 'My dog loves this food. Good quality ingredients.', 1);
db.prepare('INSERT OR IGNORE INTO reviews (product_id, user_id, customer_name, rating, title, comment, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)').run(9, 3, 'Priya Singh', 5, 'Excellent filter', 'Super quiet and effective. Highly recommended for large tanks.', 1);

// Banners
db.prepare('INSERT OR IGNORE INTO banners (title, subtitle, image, sort_order) VALUES (?, ?, ?, ?)').run('Premium Aquarium Fish', 'Imported & Freshwater Collection', '/images/banner1.jpg', 1);
db.prepare('INSERT OR IGNORE INTO banners (title, subtitle, image, sort_order) VALUES (?, ?, ?, ?)').run('Complete Pet Store', 'Dogs, Cats, Birds & More', '/images/banner2.jpg', 2);
db.prepare('INSERT OR IGNORE INTO banners (title, subtitle, image, sort_order) VALUES (?, ?, ?, ?)').run('Aquarium Setup Services', 'Custom Design & Maintenance', '/images/banner3.jpg', 3);

// Gallery
const galleryItems = [
  ['Tropical Fish Tank', '/images/gallery/1.jpg', 'aquarium'],
  ['Coral Reef Setup', '/images/gallery/2.jpg', 'aquarium'],
  ['Golden Retriever', '/images/gallery/3.jpg', 'dogs'],
  ['Persian Cat', '/images/gallery/4.jpg', 'cats'],
  ['Macaw Parrot', '/images/gallery/5.jpg', 'birds'],
  ['Store Interior', '/images/gallery/6.jpg', 'store'],
];
const insertGallery = db.prepare('INSERT OR IGNORE INTO gallery (title, image, category, sort_order) VALUES (?, ?, ?, ?)');
galleryItems.forEach((g, i) => insertGallery.run(g[0], g[1], g[2], i));

console.log('✅ Database seeded successfully!');
console.log('📧 Admin: admin@aquariumanpara.com / admin123');
process.exit(0);
