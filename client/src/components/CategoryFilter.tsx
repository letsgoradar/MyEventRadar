import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CategoryFilter({ categories, selectedCategory, onSelectCategory }) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="absolute right-4 top-4 z-10 bg-white rounded-lg shadow-lg">
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)} 
        className="flex items-center gap-2 p-3 w-full"
      >
        <span>{/*t('categories.title')*/ 'Categorie'}</span> {/* Assuming 't' function is for translation */}
        <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
      </button>
      {!isCollapsed && (
        <div className="p-4 border-t">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`block w-full text-left px-2 py-1 rounded ${
                selectedCategory === category ? 'bg-primary text-white' : 'hover:bg-gray-100'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}