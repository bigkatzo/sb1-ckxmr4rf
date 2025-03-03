import { supabase } from '../supabase';
import { withTransaction, verifyOwnership, verifyCollectionAccess, DatabaseError } from './index';
import type { Collection } from '../../types';

export async function createRecord<T extends Record<string, any>>(
  table: string,
  data: T,
  userId: string
): Promise<T> {
  return withTransaction(async () => {
    // Add user_id for tables that need it
    const recordData = table === 'collections' 
      ? { ...data, user_id: userId }
      : data;

    // For products and categories, verify collection access
    if (table === 'products' || table === 'categories') {
      const hasAccess = await verifyCollectionAccess(data.collection_id, userId, 'edit');
      if (!hasAccess) {
        throw new DatabaseError('Access denied: Edit permission required');
      }
    }

    const { data: record, error } = await supabase
      .from(table)
      .insert(recordData)
      .select()
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!record) throw new DatabaseError('Failed to create record');

    return record as T;
  });
}

export async function updateRecord<T extends Record<string, any>>(
  table: string,
  id: string,
  data: Partial<T>,
  userId: string
): Promise<T> {
  return withTransaction(async () => {
    // Verify ownership/access
    if (table === 'collections') {
      const hasAccess = await verifyOwnership(table, id, userId);
      if (!hasAccess) {
        throw new DatabaseError('Access denied: Collection ownership required');
      }
    } else {
      // Check if collection_id exists and is a string
      const collectionId = data.collection_id;
      if (typeof collectionId !== 'string') {
        throw new DatabaseError('Invalid collection_id');
      }

      const hasAccess = await verifyCollectionAccess(collectionId, userId, 'edit');
      if (!hasAccess) {
        throw new DatabaseError('Access denied: Edit permission required');
      }
    }

    const { data: record, error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!record) throw new DatabaseError('Record not found');

    return record as T;
  });
}

export async function deleteRecord(
  table: string,
  id: string,
  userId: string
): Promise<void> {
  return withTransaction(async () => {
    // Verify ownership/access
    if (table === 'collections') {
      const hasAccess = await verifyOwnership(table, id, userId);
      if (!hasAccess) {
        throw new DatabaseError('Access denied: Collection ownership required');
      }
    } else {
      const { data, error } = await supabase
        .from(table)
        .select('collection_id')
        .eq('id', id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new DatabaseError('Record not found');

      const hasAccess = await verifyCollectionAccess(data.collection_id, userId, 'edit');
      if (!hasAccess) {
        throw new DatabaseError('Access denied: Edit permission required');
      }
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw error;
  });
}

export async function getRecord<T>(
  table: string,
  id: string,
  select = '*'
): Promise<T> {
  return withTransaction(async () => {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new DatabaseError('Record not found');

    return data as T;
  });
}

export async function listRecords<T>(
  table: string,
  userId?: string,
  filters: Record<string, any> = {},
  select = '*'
): Promise<T[]> {
  return withTransaction(async () => {
    let query = supabase
      .from(table)
      .select(select);

    // Apply user filter if provided
    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Apply additional filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as T[];
  });
}