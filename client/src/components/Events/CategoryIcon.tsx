import React from 'react';
import { 
  Music, 
  Utensils, 
  Ticket, 
  Dumbbell, 
  BookOpen, 
  Code, 
  Users, 
  ShoppingBag, 
  Gamepad,
  Heart,
  TreePine,
  Palette
} from 'lucide-react';

type CategoryIconProps = {
  category: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
};

// Map legend colors
const COLORS = {
  festival: '#FF6B00',   // Orange from map
  food: '#FBBC05',       // Yellow/Gold from map
  culture: '#7B1FA2',    // Purple from map
  sport: '#0066FF',     // Blue from map
  market: '#4CAF50',     // Green
  education: '#3F51B5',  // Indigo
  music: '#4285F4',      // Google blue from map
  gaming: '#673AB7',     // Deep Purple
  technology: '#00BCD4', // Cyan
  health: '#8BC34A',     // Light Green
  nature: '#009688',     // Teal
  arts: '#DB4437',     // Another Google Red shade
  social: '#4285F4',   // Google Blue
  other: '#757575',      // Grey from map
};

export function getCategoryColor(category: string): string {
  return COLORS[category.toLowerCase()] || COLORS.other;
}

const CategoryIcon: React.FC<CategoryIconProps> = ({ 
  category, 
  size = 'md', 
  className = '' 
}) => {
  // Size mapping with 30% reduction for list view filter
  const sizeMap = {
    'xs': 16,
    'sm': 21,
    'md': 28,
    'lg': 42
  };

  const iconSize = sizeMap[size];
  const color = getCategoryColor(category);

  // Choose the right icon based on category
  const getIcon = () => {
    const iconProps = { 
      size: iconSize, 
      color: color,
      className: `category-icon ${className}`,
      style: { minWidth: iconSize, minHeight: iconSize }
    };

    switch(category.toLowerCase()) {
      case 'festival':
        return <Ticket {...iconProps} />;
      case 'food':
        return <Utensils {...iconProps} />;
      case 'culture':
        return <Palette {...iconProps} />;
      case 'music':
        return <Music {...iconProps} />;
      case 'sport':
      case 'sports':
        return <Dumbbell {...iconProps} />;
      case 'education':
        return <BookOpen {...iconProps} />;
      case 'technology':
        return <Code {...iconProps} />;
      case 'social':
      case 'networking':
        return <Users {...iconProps} />;
      case 'market':
        return <ShoppingBag {...iconProps} />;
      case 'gaming':
        return <Gamepad {...iconProps} />;
      case 'health':
        return <Heart {...iconProps} />;
      case 'nature':
        return <TreePine {...iconProps} />;
      default:
        return <Ticket {...iconProps} />;
    }
  };

  // Render the icon with a circular background
  return (
    <div 
      className={`flex items-center justify-center rounded-full p-2 ${className}`}
      style={{ 
        backgroundColor: `${color}15`, // 15% opacity of the color
        border: `2px solid ${color}`,
      }}
    >
      {getIcon()}
    </div>
  );
};

export default CategoryIcon;