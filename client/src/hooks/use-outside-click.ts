import { useEffect, RefObject } from 'react';

/**
 * Hook voor het detecteren van klikken buiten een element
 * @param ref Ref naar het element
 * @param callback Functie die wordt uitgevoerd bij klik buiten het element
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement>,
  callback: () => void
) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, callback]);
}