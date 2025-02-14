import { useState, useEffect } from 'react';
import { getCollectionQuery } from './query';
import { transformCollection } from './transformers';
import { handleCollectionError } from '../../utils/error-handlers';
import { isValidCollectionSlug } from '../../utils/validation';
import type { Collection } from '../../types';

export function useCollection(slug: string) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCollection() {
      if (!isValidCollectionSlug(slug)) {
        setError('Invalid collection URL');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: queryError } = await getCollectionQuery(slug);

        if (queryError) throw queryError;
        if (!data) throw new Error('Collection not found');

        const transformedCollection = transformCollection(data);
        setCollection(transformedCollection);
      } catch (err) {
        console.error('Error fetching collection:', err);
        setError(handleCollectionError(err));
      } finally {
        setLoading(false);
      }
    }

    fetchCollection();
  }, [slug]);

  return { collection, loading, error };
}