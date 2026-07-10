const express = require('express');
const router = express.Router();
const prisma = require('../database');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { search, category, brand, min_price, max_price, sort, page = 1, limit = 20, featured, best_seller, new_arrival, in_stock, on_sale } = req.query;
    const where = { is_active: 1 };
    if (search) where.OR = [{ name: { contains: search } }, { description: { contains: search } }];
    if (min_price) where.price = { ...where.price, gte: Number(min_price) };
    if (max_price) where.price = { ...where.price, lte: Number(max_price) };
    if (!min_price && !max_price) delete where.price;
    if (featured === '1') where.is_featured = 1;
    if (best_seller === '1') where.is_best_seller = 1;
    if (new_arrival === '1') where.is_new_arrival = 1;
    if (in_stock === '1') where.stock_quantity = { gt: 0 };
    if (on_sale === '1') where.discount_price = { gt: 0 };

    let orderBy = { created_at: 'desc' };
    if (sort === 'price_asc') orderBy = { price: 'asc' };
    else if (sort === 'price_desc') orderBy = { price: 'desc' };
    else if (sort === 'name') orderBy = { name: 'asc' };
    else if (sort === 'rating') orderBy = { rating: 'desc' };
    else if (sort === 'popular') orderBy = { sold_count: 'desc' };
    else if (sort === 'newest') orderBy = { created_at: 'desc' };

    const offset = (Number(page) - 1) * Number(limit);
    const categoryFilter = category ? { categories: { slug: category } } : {};
    const brandFilter = brand ? { brands: { slug: brand } } : {};

    const [products, total] = await Promise.all([
      prisma.products.findMany({
        where: { ...where, ...categoryFilter, ...brandFilter },
        orderBy,
        skip: offset,
        take: Number(limit),
        include: {
          categories: { select: { name: true, slug: true } },
          brands: { select: { name: true, slug: true } },
          product_images: { where: { is_primary: 1 }, take: 1 }
        }
      }),
      prisma.products.count({ where: { ...where, ...categoryFilter, ...brandFilter } })
    ]);

    const mapped = products.map(p => ({
      ...p,
      category_name: p.categories?.name,
      category_slug: p.categories?.slug,
      brand_name: p.brands?.name,
      brand_slug: p.brands?.slug,
      primary_image: p.product_images[0]?.image_url || null,
      categories: undefined, brands: undefined, product_images: undefined
    }));

    res.json({ products: mapped, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const products = await prisma.products.findMany({
      where: { is_active: 1, is_featured: 1 },
      orderBy: { sold_count: 'desc' },
      take: 8,
      include: {
        categories: { select: { name: true } },
        product_images: { where: { is_primary: 1 }, take: 1 }
      }
    });
    res.json({ products: products.map(p => ({ ...p, category_name: p.categories?.name, primary_image: p.product_images[0]?.image_url || null, categories: undefined, product_images: undefined })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/best-sellers', async (req, res) => {
  try {
    const products = await prisma.products.findMany({
      where: { is_active: 1, is_best_seller: 1 },
      orderBy: { sold_count: 'desc' },
      take: 8,
      include: {
        categories: { select: { name: true } },
        product_images: { where: { is_primary: 1 }, take: 1 }
      }
    });
    res.json({ products: products.map(p => ({ ...p, category_name: p.categories?.name, primary_image: p.product_images[0]?.image_url || null, categories: undefined, product_images: undefined })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/new-arrivals', async (req, res) => {
  try {
    const products = await prisma.products.findMany({
      where: { is_active: 1, is_new_arrival: 1 },
      orderBy: { created_at: 'desc' },
      take: 8,
      include: {
        categories: { select: { name: true } },
        product_images: { where: { is_primary: 1 }, take: 1 }
      }
    });
    res.json({ products: products.map(p => ({ ...p, category_name: p.categories?.name, primary_image: p.product_images[0]?.image_url || null, categories: undefined, product_images: undefined })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug', async (req, res) => {
  try {
    const product = await prisma.products.findFirst({
      where: { slug: req.params.slug, is_active: 1 },
      include: {
        categories: { select: { name: true, slug: true } },
        brands: { select: { name: true } }
      }
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const [images, reviews, related] = await Promise.all([
      prisma.product_images.findMany({ where: { product_id: product.id }, orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }] }),
      prisma.reviews.findMany({ where: { product_id: product.id, is_approved: 1 }, orderBy: { created_at: 'desc' }, include: { users: { select: { name: true } } } }),
      prisma.products.findMany({
        where: { category_id: product.category_id, id: { not: product.id }, is_active: 1 },
        take: 4,
        include: { product_images: { where: { is_primary: 1 }, take: 1 } }
      })
    ]);

    const result = {
      ...product,
      category_name: product.categories?.name,
      category_slug: product.categories?.slug,
      brand_name: product.brands?.name,
      images,
      reviews: reviews.map(r => ({ ...r, user_name: r.users?.name })),
      related: related.map(p => ({ ...p, primary_image: p.product_images[0]?.image_url || null }))
    };
    delete result.categories;
    delete result.brands;
    res.json({ product: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name, description, short_description, sku, barcode, price, discount_price, cost_price, category_id, brand_id,
      stock_quantity, low_stock_threshold, weight, is_featured, is_best_seller, is_new_arrival, meta_title, meta_description, images } = req.body;

    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let finalSlug = slug;
    let counter = 1;
    while (await prisma.products.findFirst({ where: { slug: finalSlug }, select: { id: true } })) {
      finalSlug = `${slug}-${counter++}`;
    }

    const result = await prisma.products.create({
      data: {
        name, slug: finalSlug, description, short_description, sku, barcode,
        price: price || 0, discount_price: discount_price || 0, cost_price: cost_price || 0,
        category_id, brand_id, stock_quantity: stock_quantity || 0,
        low_stock_threshold: low_stock_threshold || 5, weight: weight || 0,
        is_featured: is_featured ? 1 : 0, is_best_seller: is_best_seller ? 1 : 0,
        is_new_arrival: is_new_arrival ? 1 : 0, meta_title, meta_description
      }
    });

    if (images && images.length) {
      await prisma.product_images.createMany({
        data: images.map((img, i) => ({
          product_id: result.id, image_url: img.url || img, is_primary: i === 0 ? 1 : 0, sort_order: i
        }))
      });
    }

    if (stock_quantity > 0) {
      await prisma.inventory_logs.create({
        data: { product_id: result.id, type: 'purchase', quantity: stock_quantity, reference: 'INITIAL', notes: 'Initial stock' }
      });
    }

    res.status(201).json({ product: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, description, short_description, sku, barcode, price, discount_price, cost_price, category_id, brand_id,
      stock_quantity, low_stock_threshold, weight, is_featured, is_best_seller, is_new_arrival, is_active, meta_title, meta_description } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (short_description !== undefined) data.short_description = short_description;
    if (sku !== undefined) data.sku = sku;
    if (barcode !== undefined) data.barcode = barcode;
    if (price !== undefined) data.price = price;
    if (discount_price !== undefined) data.discount_price = discount_price;
    if (cost_price !== undefined) data.cost_price = cost_price;
    if (category_id !== undefined) data.category_id = category_id;
    if (brand_id !== undefined) data.brand_id = brand_id;
    if (stock_quantity !== undefined) data.stock_quantity = stock_quantity;
    if (low_stock_threshold !== undefined) data.low_stock_threshold = low_stock_threshold;
    if (weight !== undefined) data.weight = weight;
    if (is_featured !== undefined) data.is_featured = is_featured ? 1 : 0;
    if (is_best_seller !== undefined) data.is_best_seller = is_best_seller ? 1 : 0;
    if (is_new_arrival !== undefined) data.is_new_arrival = is_new_arrival ? 1 : 0;
    if (is_active !== undefined) data.is_active = is_active ? 1 : 0;
    if (meta_title !== undefined) data.meta_title = meta_title;
    if (meta_description !== undefined) data.meta_description = meta_description;
    data.updated_at = new Date();

    const product = await prisma.products.update({ where: { id: Number(req.params.id) }, data });
    res.json({ product });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await prisma.products.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Product deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
