
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function CategoryFilter({ categories, selectedCategory, onSelectCategory }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md z-10">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2 text-sm font-medium"
      >
        <span>Categorie</span>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="p-2 bg-white rounded-b-lg border-t">
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
