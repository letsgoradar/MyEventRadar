
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
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

// Google-inspired color palette
const COLORS = {
  festival: '#4285F4', // Google Blue
  food: '#FBBC05',     // Google Yellow
  culture: '#34A853',  // Google Green
  sport: '#EA4335',    // Google Red
  market: '#4285F4',   // Google Blue
  education: '#34A853',// Google Green
  music: '#FBBC05',    // Google Yellow
  gaming: '#EA4335',   // Google Red
  technology: '#4285F4',// Google Blue
  health: '#34A853',   // Google Green
  nature: '#0F9D58',   // Another Google Green shade
  arts: '#DB4437',     // Another Google Red shade
  social: '#4285F4',   // Google Blue
  other: '#757575',    // Grey for other
};

export function getCategoryColor(category: string): string {
  return COLORS[category.toLowerCase()] || COLORS.other;
}

const CategoryIcon: React.FC<CategoryIconProps> = ({ 
  category, 
  size = 'md', 
  className = '' 
}) => {
  // Size mapping
  const sizeMap = {
    'sm': 24,
    'md': 32,
    'lg': 48
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
