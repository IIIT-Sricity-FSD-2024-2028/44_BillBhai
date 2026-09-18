export default function SearchBar({ searchQuery, onSearchChange }) {
  return (
    <div className="pos-search">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      <input type="text" id="posSearch" placeholder="Fuzzy Search products... (e.g. 'Dal', 'L')" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} />
    </div>
  );
}
