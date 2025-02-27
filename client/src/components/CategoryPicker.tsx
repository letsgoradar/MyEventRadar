import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const CATEGORIES = {
  'Sport': [
    'Voetbal', 'Hardlopen', 'Fietsen', 'Basketbal', 'Tennis', 'Yoga', 'Klimmen', 'Zwemmen'
  ],
  'Cultuur': [
    'Theater', 'Muziek', 'Film', 'Dans', 'Kunst', 'Literatuur', 'Fotografie'
  ],
  'Educatie': [
    'Workshops', 'Lezingen', 'Cursussen', 'Studiegroepen', 'Tech Meetups'
  ],
  'Gezondheid & Welzijn': [
    'Mindfulness', 'Fitness', 'Gezondheid', 'Massage & Spa', 'Voeding'
  ],
  'Natuur & Avontuur': [
    'Wandeltochten', 'Fietstochten', 'Kamperen', 'Strandactiviteiten', 'Vogels kijken'
  ],
  'Sociale Activiteiten': [
    'Meetups', 'Picknicks', 'Spelletjesavonden', 'Film- of boekenclubs', 'Borrel of Pub Meetup'
  ],
  'Familie & Kinderen': [
    'Kinderworkshops', 'Gezinsuitjes', 'Gezinsfilmavond', 'Kinderfeestjes'
  ],
  'Vrijwilligerswerk & Goede Doelen': [
    'Strand- of parkopruiming', 'Huisdierenopvang', 'Eten uitdelen', 'Groene initiatieven'
  ],
  'Creatieve Activiteiten': [
    'Kunst en Ambachten', 'Mode', 'Muziek maken', 'DIY & Knutselen'
  ],
  'Reizen & Avontuur': [
    'Stadsrondleidingen', 'Outdoor Avonturen', 'Roadtrips', 'Excursies'
  ]
};

interface CategoryPickerProps extends React.ComponentPropsWithoutRef<typeof Select> {
  onValueChange?: (value: string) => void;
}

export const CategoryPicker = React.forwardRef<
  React.ElementRef<typeof Select>,
  CategoryPickerProps
>(({ onValueChange, ...props }, ref) => {
  const [mainCategory, setMainCategory] = React.useState<string>('');
  const [customCategory, setCustomCategory] = React.useState<string>('');
  const [showCustomInput, setShowCustomInput] = React.useState(false);

  const handleMainCategoryChange = (value: string) => {
    setMainCategory(value);
    setShowCustomInput(value === 'Overige');
    onValueChange?.(value);
  };

  const handleCustomCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomCategory(value);
    onValueChange?.('Overige');
  };

  return (
    <div className="space-y-2">
      <Select 
        value={mainCategory} 
        onValueChange={handleMainCategoryChange}
        ref={ref}
        {...props}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecteer categorie" />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(CATEGORIES).map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
          <SelectItem value="Overige">Overige</SelectItem>
        </SelectContent>
      </Select>

      {showCustomInput && (
        <Input
          placeholder="Voer eigen categorie in"
          value={customCategory}
          onChange={handleCustomCategoryChange}
        />
      )}
    </div>
  );
});

CategoryPicker.displayName = "CategoryPicker";