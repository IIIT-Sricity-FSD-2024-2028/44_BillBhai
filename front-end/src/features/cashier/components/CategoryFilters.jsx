export default function CategoryFilters({
  categories,
  selectedCategory,
  normalized,
  onSelectCategory,
}) {
  return (
    <div className="category-filters" id="categoryFilters">
      {categories.map((c) => {
        let className = c === selectedCategory ? 'cat-btn active' : 'cat-btn ';
        if (normalized && c !== selectedCategory) className = 'cat-btn';
        return (
          <button key={c} className={className} onClick={() => onSelectCategory(c)}>
            {c}
          </button>
        );
      })}
    </div>
  );
}
