import ProductCard from './ProductCard.jsx';

// `products` is null until the catalog is first rendered (step 1 submit).
export default function ProductGrid({ products, cartQty = {}, onAddToCart, onShowOptions }) {
  let content = null;
  if (products && products.length === 0) {
    content = <div className="empty-state">No products found.</div>;
  } else if (products) {
    content = products.map((p) => (
      <ProductCard
        key={p.id}
        product={p}
        inCart={cartQty[p.id] || 0}
        onAddToCart={onAddToCart}
        onShowOptions={onShowOptions}
      />
    ));
  }

  return (
    <div className="product-grid" id="productGrid">
      {content}
    </div>
  );
}
