import React from 'react';
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

interface CategoryPickerProps {
  onCategoryChange: (category: string, subcategory: string) => void;
}

export function CategoryPicker({ onCategoryChange }: CategoryPickerProps) {
  const [mainCategory, setMainCategory] = React.useState<string>('');
  const [subCategory, setSubCategory] = React.useState<string>('');
  const [customCategory, setCustomCategory] = React.useState<string>('');
  const [showCustomInput, setShowCustomInput] = React.useState(false);

  const handleMainCategoryChange = (value: string) => {
    setMainCategory(value);
    setSubCategory('');
    setShowCustomInput(value === 'Overige');
    onCategoryChange(value, '');
  };

  const handleSubCategoryChange = (value: string) => {
    setSubCategory(value);
    onCategoryChange(mainCategory, value);
  };

  const handleCustomCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomCategory(value);
    onCategoryChange('Overige', value);
  };

  return (
    <div className="space-y-2">
      <Select value={mainCategory} onValueChange={handleMainCategoryChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select category" />
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

      {mainCategory && !showCustomInput && (
        <Select value={subCategory} onValueChange={handleSubCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select subcategory" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES[mainCategory as keyof typeof CATEGORIES]?.map((sub) => (
              <SelectItem key={sub} value={sub}>
                {sub}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showCustomInput && (
        <Input
          placeholder="Enter custom category"
          value={customCategory}
          onChange={handleCustomCategoryChange}
        />
      )}
    </div>
  );
}