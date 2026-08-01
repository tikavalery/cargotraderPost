import StoreCard from './StoreCard';

export default function StoreGrid({ stores, totalCount, searchActive, onEdit, onDelete }) {
  if (!stores.length) {
    return (
      <div className="empty-grid">
        {searchActive && totalCount > 0
          ? 'No stores match your search'
          : 'No stores yet — add your first retail location'}
      </div>
    );
  }

  return (
    <div className="store-grid">
      {stores.map((store) => (
        <StoreCard key={store.storeId} store={store} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
