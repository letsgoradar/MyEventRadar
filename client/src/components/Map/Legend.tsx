import { CATEGORIES } from '@shared/schema';
import { CATEGORY_COLORS } from '../CategoryIcon';

export default function Legend() {
  return (
    <div className="absolute bottom-4 right-4 bg-white/90 p-3 rounded-lg shadow-lg z-[1000]">
      <h3 className="text-sm font-medium mb-2">Categorieën</h3>
      <div className="space-y-1">
        {CATEGORIES.map((category) => (
          <div key={category} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[category] }}
            />
            <span className="text-xs">{category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}