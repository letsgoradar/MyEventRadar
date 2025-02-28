
import React from 'react';

type CategoryIconProps = {
  category: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

// Using free open-source images from Heroicons and Tabler icons
const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const getCategoryColor = (category: string): string => {
    const colors = {
      'festival': '#FF6B00',
      'sport': '#0066FF',
      'music': '#4285F4',
      'food': '#FBBC05',
      'culture': '#7B1FA2',
      'market': '#34A853',
      'education': '#4A90E2',
      'other': '#757575',
    };
    
    return colors[category.toLowerCase()] || colors.other;
  };

  const getCategoryIcon = (category: string) => {
    const color = getCategoryColor(category);
    
    switch (category.toLowerCase()) {
      case 'festival':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5.5 7C5.5 7 8 5 12 5C16 5 18.5 7 18.5 7" fill={color} />
            <path d="M18.5 17C18.5 17 16 19 12 19C8 19 5.5 17 5.5 17" fill={color} />
            <path d="M5.5 7L5.5 17" stroke={color} />
            <path d="M18.5 7L18.5 17" stroke={color} />
            <path d="M8 9.5L8 14.5" stroke={color} />
            <path d="M12 8L12 16" stroke={color} />
            <path d="M16 9.5L16 14.5" stroke={color} />
          </svg>
        );
      case 'sport':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" fill={color} fillOpacity="0.2" />
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 0 1 8 8h-3a5 5 0 0 0-5-5V2zm0 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill={color} />
          </svg>
        );
      case 'music':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="18" r="4" fill={color} fillOpacity="0.2" />
            <path d="M12 18V2l7 4" stroke={color} />
          </svg>
        );
      case 'food':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 10h10" stroke={color} />
            <path d="M7 14h10" stroke={color} />
            <path fill={color} fillOpacity="0.2" d="M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
            <path d="M4 10h16" stroke={color} />
          </svg>
        );
      case 'culture':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h20" stroke={color} />
            <path fill={color} fillOpacity="0.2" d="M12 2a1 1 0 0 1 1 1v4h2a1 1 0 0 1 1 1v3h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-16a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h2v-3a1 1 0 0 1 1-1h2v-4a1 1 0 0 1 1-1" />
            <path d="M7 8v14" stroke={color} />
            <path d="M17 8v14" stroke={color} />
            <path d="M12 2v20" stroke={color} />
          </svg>
        );
      case 'market':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path fill={color} fillOpacity="0.2" d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
            <path d="M3 9l2-5h14l2 5" stroke={color} />
            <path d="M9 14v3" stroke={color} />
            <path d="M15 14v3" stroke={color} />
          </svg>
        );
      case 'education':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4L3 9l9 5l9-5L12 4Z" fill={color} fillOpacity="0.2" />
            <path d="M12 4L3 9l9 5l9-5L12 4Z" stroke={color} />
            <path d="M3 9v6" stroke={color} />
            <path d="M12 14v6" stroke={color} />
            <path d="M21 9v6" stroke={color} />
            <path d="M12 14l-9-5" stroke={color} />
            <path d="M12 14l9-5" stroke={color} />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v2" stroke={color} />
            <path d="M12 20v2" stroke={color} />
            <path d="M4.93 4.93l1.41 1.41" stroke={color} />
            <path d="M17.66 17.66l1.41 1.41" stroke={color} />
            <path d="M2 12h2" stroke={color} />
            <path d="M20 12h2" stroke={color} />
            <path d="M6.34 17.66l-1.41 1.41" stroke={color} />
            <path d="M19.07 4.93l-1.41 1.41" stroke={color} />
            <circle cx="12" cy="12" r="6" fill={color} fillOpacity="0.2" />
          </svg>
        );
    }
  };

  return (
    <div className={`${sizeClasses[size]} ${className} rounded-lg overflow-hidden bg-white shadow-sm`}>
      {getCategoryIcon(category)}
    </div>
  );
};

export default CategoryIcon;
