import * as React from 'react';
import { forwardRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIES = {
  'festival': ['Muziek', 'Eten', 'Cultuur', 'Kunst'],
  'sports': ['Voetbal', 'Hardlopen', 'Fietsen', 'Basketbal', 'Tennis', 'Yoga', 'Klimmen', 'Zwemmen'],
  'food': ['Markt', 'Proeverij', 'Workshop', 'Beurs'],
  'culture': ['Theater', 'Muziek', 'Film', 'Dans', 'Kunst', 'Literatuur', 'Fotografie'],
  'market': ['Eten', 'Antiek', 'Ambacht', 'Boeren'],
  'education': ['Workshop', 'Lezing', 'Cursus', 'Studiegroep', 'Tech Meetup'],
  'music': ['Klassiek', 'Jazz', 'Pop', 'Rock', 'Elektronisch'],
  'technology': ['Meetup', 'Conferentie', 'Workshop', 'Hackathon'],
  'gaming': ['eSports', 'Bordspellen', 'RPG', 'Kaartspellen'],
  'health': ['Fitness', 'Welzijn', 'Voeding', 'Meditatie'],
  'nature': ['Wandelen', 'Vogels Spotten', 'Tuinieren', 'Natuurbehoud']
};

interface CategoryPickerProps extends React.ComponentPropsWithoutRef<typeof Select> {
  onValueChange?: (value: string) => void;
  onSubcategoryChange?: (value: string) => void;
}

export const CategoryPicker = forwardRef<
  React.ElementRef<typeof Select>,
  CategoryPickerProps
>(({ onValueChange, onSubcategoryChange, ...props }, ref) => {
  const [mainCategory, setMainCategory] = React.useState<string>('');
  const [subcategory, setSubcategory] = React.useState<string>('');

  const handleMainCategoryChange = (value: string) => {
    setMainCategory(value);
    setSubcategory(''); // Reset subcategory when main category changes
    onValueChange?.(value);
  };

  const handleSubcategoryChange = (value: string) => {
    setSubcategory(value);
    onSubcategoryChange?.(value);
  };

  return (
    <div className="space-y-2">
      <Select 
        value={mainCategory} 
        onValueChange={handleMainCategoryChange}
        {...props}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecteer categorie" />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(CATEGORIES).map((category) => (
            <SelectItem key={category} value={category}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {mainCategory && CATEGORIES[mainCategory] && (
        <Select
          value={subcategory}
          onValueChange={handleSubcategoryChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecteer subcategorie" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES[mainCategory].map((sub) => (
              <SelectItem key={sub} value={sub}>
                {sub}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
});

CategoryPicker.displayName = "CategoryPicker";

export { CATEGORIES };