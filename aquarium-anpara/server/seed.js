require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const prisma = require('./database');
const bcrypt = require('bcryptjs');

(async () => {
  console.log('Seeding database...');

  const adminPass = await bcrypt.hash('admin123', 10);
  const customerPass = await bcrypt.hash('customer123', 10);

  const createUser = async (name, email, phone, password, role) => {
    const existing = await prisma.users.findFirst({ where: { OR: [{ email }, { phone }] } });
    if (!existing) {
      await prisma.users.create({ data: { name, email, phone, password, role } });
    }
  };
  await createUser('Admin', 'admin@aquariumanpara.com', '9999999999', adminPass, 'admin');
  await createUser('Rahul Kumar', 'rahul@test.com', '8888888888', customerPass, 'customer');
  await createUser('Priya Singh', 'priya@test.com', '7777777777', customerPass, 'customer');

  const defaultSettings = [
    { key: 'shop_name', value: 'Aquarium Anpara' },
    { key: 'shop_phone', value: '+91 98765 43210' },
    { key: 'shop_email', value: 'info@aquariumanpara.com' },
    { key: 'shop_address', value: 'Aquarium Anpara, Main Road, Anpara, India' },
    { key: 'whatsapp_number', value: '919876543210' },
    { key: 'shop_logo', value: '/images/logo.png' },
    { key: 'min_order_free_delivery', value: '500' },
    { key: 'delivery_charge', value: '50' }
  ];
  for (const s of defaultSettings) {
    await prisma.settings.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  const catData = [
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
  for (const [name, slug, description, sort_order] of catData) {
    await prisma.categories.upsert({ where: { slug }, update: {}, create: { name, slug, description, sort_order } });
  }

  const getCatId = async (slug) => { const c = await prisma.categories.findFirst({ where: { slug } }); return c?.id; };

  const subcatData = [
    ['Imported Fishes', 'imported-fishes', 'Premium imported aquarium fishes', 'aquarium', 1],
    ['Freshwater Fishes', 'freshwater-fishes', 'Freshwater aquarium fishes', 'aquarium', 2],
    ['Marine Fishes', 'marine-fishes', 'Saltwater marine fishes', 'aquarium', 3],
    ['Tanks', 'tanks', 'Aquarium tanks and setups', 'aquarium', 4],
    ['Imported Dog Breeds', 'imported-dog-breeds', 'Premium imported dog breeds', 'dogs', 1],
    ['Indian Dog Breeds', 'indian-dog-breeds', 'Indian native dog breeds', 'dogs', 2],
    ['Filters', 'filters', 'Aquarium filters', 'aquarium-equipment', 1],
    ['Pumps', 'pumps', 'Aquarium pumps', 'aquarium-equipment', 2],
    ['Lights', 'lights', 'Aquarium lights', 'aquarium-equipment', 3],
  ];
  for (const [name, slug, desc, parentSlug, sort] of subcatData) {
    const parent = await getCatId(parentSlug);
    if (parent) {
      await prisma.categories.upsert({ where: { slug }, update: {}, create: { name, slug, description: desc, parent_id: parent, sort_order: sort } });
    }
  }

  const brandList = [
    ['Fluval', 'fluval', 'Premium aquarium equipment'],
    ['Tetra', 'tetra', 'Quality fish foods'],
    ['Drools', 'drools', 'Indian pet food brand'],
    ['Pedigree', 'pedigree', 'World famous dog food'],
    ['Whiskas', 'whiskas', 'Cat food brand'],
    ['Hikari', 'hikari', 'Japanese fish food'],
    ['Sera', 'sera', 'German aquarium brand'],
    ['Royal Canin', 'royal-canin', 'Premium pet nutrition']
  ];
  for (const [name, slug, desc] of brandList) {
    await prisma.brands.upsert({ where: { slug }, update: {}, create: { name, slug, description: desc } });
  }

  const getBrandId = async (slug) => { const b = await prisma.brands.findFirst({ where: { slug } }); return b?.id; };

  const [importFishCatId, freshFishCatId, tanksCatId, fishFoodCatId, dogFoodCatId, importedDogCatId, catsCatId, birdsCatId, catFoodCatId, plantsCatId, decorCatId, accessoriesCatId, equipCatId, filterCatId, medicineCatId] = await Promise.all([
    getCatId('imported-fishes'), getCatId('freshwater-fishes'), getCatId('tanks'), getCatId('fish-foods'), getCatId('dog-foods'),
    getCatId('imported-dog-breeds'), getCatId('cats'), getCatId('birds'), getCatId('cat-foods'), getCatId('plants'),
    getCatId('decorations'), getCatId('accessories'), getCatId('aquarium-equipment'), getCatId('filters'), getCatId('medicines')
  ]);
  const [fluvalId, tetraId, droolsId, pedigreeId, whiskasId, hikariId, seraId, royalCaninId] = await Promise.all(brandList.map(b => getBrandId(b[1])));

  const products = [
    ['Red Eye Red Parrot Fish', 'red-eye-red-parrot-fish', 'Beautiful Red Eye Red Parrot Fish for your aquarium. Vibrant color, active swimmer.', 'Vibrant red parrot fish', 450, 399, 250, importFishCatId, null, 25, 1, 1, 1, 4.5, 12, 45],
    ['Blue Gold Macaw Parrot', 'blue-gold-macaw', 'Stunning Blue & Gold Macaw. Hand-raised, friendly, and healthy.', 'Premium imported parrot', 25000, 22999, 18000, birdsCatId, null, 3, 1, 1, 0, 4.8, 5, 8],
    ['Golden Retriever Puppy', 'golden-retriever-puppy', 'Pure breed Golden Retriever puppy. Vaccinated and health certified.', 'Friendly & loyal breed', 15000, 13999, 10000, importedDogCatId, null, 5, 1, 1, 0, 4.7, 8, 12],
    ['German Shepherd Puppy', 'german-shepherd-puppy', 'Strong and intelligent German Shepherd. Fully vaccinated.', 'Guard dog breed', 18000, 16999, 12000, importedDogCatId, null, 4, 1, 0, 1, 4.6, 6, 10],
    ['Persian Cat Kitten', 'persian-cat-kitten', 'Adorable Persian cat kitten. Fluffy coat, gentle nature.', 'Luxury pet cat', 8000, 7499, 5000, catsCatId, null, 6, 1, 1, 0, 4.4, 9, 15],
    ['Drools Ocean Fish Adult Dog Food 3kg', 'drools-ocean-fish-dog-food', 'Premium ocean fish recipe for adult dogs. Rich in omega fatty acids.', 'Nutritious dog food', 650, 599, 400, dogFoodCatId, droolsId, 50, 1, 1, 0, 4.3, 20, 80],
    ['Pedigree Adult Dog Food 10kg', 'pedigree-adult-dog-food', 'Complete nutrition for adult dogs. Trusted brand worldwide.', 'Best-selling dog food', 1200, 1099, 800, dogFoodCatId, pedigreeId, 40, 1, 1, 0, 4.2, 25, 120],
    ['Whiskas Adult Cat Food 1.2kg', 'whiskas-cat-food', 'Delicious cat food with real chicken. Cats love the taste.', 'Tasty cat food', 350, 319, 200, catFoodCatId, whiskasId, 35, 0, 1, 0, 4.1, 15, 65],
    ['Fluval 307 Performance Canister Filter', 'fluval-307-filter', 'Advanced 3-stage filtration for aquariums up to 700L. Whisper-quiet operation.', 'Professional aquarium filter', 8500, 7999, 5500, filterCatId, fluvalId, 10, 1, 0, 1, 4.7, 8, 20],
    ['TetraMin Tropical Fish Flakes 250ml', 'tetra-min-flakes', 'Premium tropical fish food. Enhances color and vitality.', 'Quality fish food', 280, 249, 150, fishFoodCatId, tetraId, 60, 0, 1, 0, 4.3, 30, 150],
    ['Hikari Gold Fish Food Pellets', 'hikari-gold-fish-food', 'Japanese quality fish food for goldfish. Floating pellets.', 'Premium fish food', 450, 399, 280, fishFoodCatId, hikariId, 30, 1, 0, 1, 4.5, 18, 40],
    ['Sera Aquatan Water Conditioner', 'sera-aquatan', 'Makes tap water safe for fish. Removes chlorine and heavy metals.', 'Essential aquarium treatment', 320, 299, 180, medicineCatId, seraId, 25, 0, 0, 0, 4.4, 12, 35],
    ['5 Gallon Nano Aquarium Tank', 'nano-aquarium-tank-5g', 'Compact desktop aquarium with LED light. Perfect for beginners.', 'Starter aquarium kit', 3500, 3199, 2200, tanksCatId, null, 15, 1, 1, 1, 4.3, 10, 25],
    ['20 Gallon Rectangle Aquarium Tank', 'aquarium-tank-20g', 'Spacious rectangular tank with strong glass. Great for community fish.', 'Large aquarium tank', 8000, 7499, 5000, tanksCatId, null, 8, 1, 0, 0, 4.5, 7, 18],
    ['Live Amazon Sword Plant', 'amazon-sword-plant', 'Beautiful live aquarium plant. Easy to care, oxygenates water naturally.', 'Live aquarium plant', 150, 129, 60, plantsCatId, null, 40, 0, 0, 1, 4.2, 22, 90],
    ['Ceramic Castle Aquarium Decoration', 'ceramic-castle-decor', 'Detailed ceramic castle for aquarium decoration. Fish-friendly.', 'Aquarium decor', 550, 499, 300, decorCatId, null, 20, 0, 1, 0, 4.1, 14, 55],
    ['Adjustable Aquarium Air Pump', 'aquarium-air-pump', 'Quiet adjustable air pump for aquariums. Energy efficient.', 'Essential aquarium equipment', 600, 549, 350, equipCatId, null, 18, 1, 0, 0, 4.3, 16, 42],
    ['LED Aquarium Light 60cm', 'led-aquarium-light-60cm', 'Slim LED light for planted aquariums. Multiple color modes.', 'Aquarium LED light', 1800, 1649, 1100, equipCatId, null, 12, 1, 1, 1, 4.6, 9, 28],
    ['Labrador Retriever Puppy', 'labrador-retriever-puppy', 'Active and playful Labrador puppy. Health guaranteed.', 'Family dog breed', 12000, 10999, 8000, importedDogCatId, null, 6, 1, 0, 1, 4.7, 11, 22],
    ['Rabbit Hutch Wooden Cage', 'rabbit-hutch-wooden', 'Spacious wooden rabbit hutch. Weather-resistant, comfortable.', 'Pet housing', 4500, 4199, 2800, accessoriesCatId, null, 8, 0, 0, 1, 4.2, 5, 12],
  ];

  for (const p of products) {
    try {
      const existing = await prisma.products.findFirst({ where: { slug: p[1] } });
      if (existing) continue;
      const product = await prisma.products.create({
        data: {
          name: p[0], slug: p[1], description: p[2], short_description: p[3],
          price: p[4], discount_price: p[5], cost_price: p[6], category_id: p[7], brand_id: p[8],
          stock_quantity: p[9], is_featured: p[10], is_best_seller: p[11], is_new_arrival: p[12],
          rating: p[13], review_count: p[14], sold_count: p[15]
        }
      });
      await prisma.product_images.createMany({
        data: [
          { product_id: product.id, image_url: `/images/products/${products.indexOf(p) + 1}.jpg`, is_primary: 1, sort_order: 0 },
          { product_id: product.id, image_url: `/images/products/${products.indexOf(p) + 1}_b.jpg`, is_primary: 0, sort_order: 1 }
        ]
      });
    } catch (e) {}
  }

  const coupons = [
    ['WELCOME10', 'Welcome discount 10%', 'percentage', 10, 200],
    ['FLAT100', 'Flat ₹100 off', 'fixed', 100, 500],
    ['FISH20', 'Fish special 20% off', 'percentage', 20, 300]
  ];
  for (const [code, desc, type, value, min] of coupons) {
    await prisma.coupons.upsert({ where: { code }, update: {}, create: { code, description: desc, discount_type: type, discount_value: value, min_order: min, is_active: 1 } });
  }

  try {
    const product1 = await prisma.products.findFirst({ where: { slug: 'red-eye-red-parrot-fish' } });
    const product6 = await prisma.products.findFirst({ where: { slug: 'drools-ocean-fish-dog-food' } });
    const product9 = await prisma.products.findFirst({ where: { slug: 'fluval-307-filter' } });
    const user2 = await prisma.users.findFirst({ where: { email: 'rahul@test.com' } });
    const user3 = await prisma.users.findFirst({ where: { email: 'priya@test.com' } });
    if (product1 && user2) {
      await prisma.reviews.upsert({
        where: { id: 1 }, update: {},
        create: { product_id: product1.id, user_id: user2.id, customer_name: 'Rahul Kumar', rating: 5, title: 'Beautiful fish!', comment: 'Very healthy and active fish. Great quality from Aquarium Anpara.', is_approved: 1 }
      });
    }
    if (product6 && user2) {
      await prisma.reviews.upsert({
        where: { id: 2 }, update: {},
        create: { product_id: product6.id, user_id: user2.id, customer_name: 'Rahul Kumar', rating: 4, title: 'Good quality food', comment: 'My dog loves this food. Good quality ingredients.', is_approved: 1 }
      });
    }
    if (product9 && user3) {
      await prisma.reviews.upsert({
        where: { id: 3 }, update: {},
        create: { product_id: product9.id, user_id: user3.id, customer_name: 'Priya Singh', rating: 5, title: 'Excellent filter', comment: 'Super quiet and effective. Highly recommended for large tanks.', is_approved: 1 }
      });
    }
  } catch (e) {}

  const bannerData = [
    ['Premium Aquarium Fish', 'Imported & Freshwater Collection', '/images/banner1.jpg', 1],
    ['Complete Pet Store', 'Dogs, Cats, Birds & More', '/images/banner2.jpg', 2],
    ['Aquarium Setup Services', 'Custom Design & Maintenance', '/images/banner3.jpg', 3]
  ];
  for (const [title, subtitle, image, sort] of bannerData) {
    await prisma.banners.upsert({ where: { id: sort }, update: {}, create: { title, subtitle, image, sort_order: sort } });
  }

  const galleryItems = [
    ['Tropical Fish Tank', '/images/gallery/1.jpg', 'aquarium'],
    ['Coral Reef Setup', '/images/gallery/2.jpg', 'aquarium'],
    ['Golden Retriever', '/images/gallery/3.jpg', 'dogs'],
    ['Persian Cat', '/images/gallery/4.jpg', 'cats'],
    ['Macaw Parrot', '/images/gallery/5.jpg', 'birds'],
    ['Store Interior', '/images/gallery/6.jpg', 'store'],
  ];
  for (const [title, image, category] of galleryItems) {
    await prisma.gallery.upsert({ where: { id: galleryItems.indexOf([title, image, category]) + 1 }, update: {}, create: { title, image, category } });
  }

  console.log('✅ Database seeded successfully!');
  console.log('📧 Admin: admin@aquariumanpara.com / admin123');
  process.exit(0);
})();
