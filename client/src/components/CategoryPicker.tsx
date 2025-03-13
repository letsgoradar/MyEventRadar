import * as React from 'react';
import { forwardRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIES } from '@shared/schema';

interface CategoryPickerProps extends React.ComponentPropsWithoutRef<typeof Select> {
  onValueChange?: (value: string) => void;
}

export const CategoryPicker = forwardRef<
  React.ElementRef<typeof Select>,
  CategoryPickerProps
>((props, ref) => {
  return (
    <Select {...props} ref={ref}>
      <SelectTrigger>
        <SelectValue placeholder="Selecteer categorie" />
      </SelectTrigger>
      <SelectContent>
        {CATEGORIES.map((category) => (
          <SelectItem key={category} value={category}>
            {category}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

CategoryPicker.displayName = "CategoryPicker";

export { CATEGORIES };