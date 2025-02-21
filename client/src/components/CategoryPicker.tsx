
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

export function CategoryPicker() {
  const [mainCategory, setMainCategory] = React.useState<string>('');
  const [subCategory, setSubCategory] = React.useState<string>('');

  return (
    <div className="space-y-2">
      <Select value={mainCategory} onValueChange={setMainCategory}>
        <SelectTrigger>
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(CATEGORIES).map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {mainCategory && (
        <Select value={subCategory} onValueChange={setSubCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Select subcategory" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES[mainCategory as keyof typeof CATEGORIES].map((sub) => (
              <SelectItem key={sub} value={sub}>
                {sub}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
