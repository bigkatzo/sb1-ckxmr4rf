import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Database } from '@/types/supabase';
import { Button, Select, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface UserAccess {
  id: string;
  user_id: string;
  collection_id: string | null;
  category_id: string | null;
  product_id: string | null;
  access_level: 'view' | 'edit';
  granted_at: string;
  user_email: string;
  content_name: string;
  content_type: 'collection' | 'category' | 'product';
}

interface ContentItem {
  id: string;
  name: string;
}

const UserAccessManager: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const [loading, setLoading] = useState(true);
  const [accessList, setAccessList] = useState<UserAccess[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [collections, setCollections] = useState<ContentItem[]>([]);
  const [categories, setCategories] = useState<ContentItem[]>([]);
  const [products, setProducts] = useState<ContentItem[]>([]);

  // Form states for granting new access
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedContentType, setSelectedContentType] = useState<'collection' | 'category' | 'product'>('collection');
  const [selectedContent, setSelectedContent] = useState<string>('');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<'view' | 'edit'>('view');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('user_id, email');
      
      if (userError) throw userError;
      setUsers(userData.map(u => ({ id: u.user_id, email: u.email })));

      // Fetch collections
      const { data: collectionData, error: collectionError } = await supabase
        .from('collections')
        .select('id, name');
      
      if (collectionError) throw collectionError;
      setCollections(collectionData);

      // Fetch categories
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, name');
      
      if (categoryError) throw categoryError;
      setCategories(categoryData);

      // Fetch products
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name');
      
      if (productError) throw productError;
      setProducts(productData);

      // Fetch current access list
      const { data: accessData, error: accessError } = await supabase
        .from('content_access')
        .select(`
          id,
          user_id,
          collection_id,
          category_id,
          product_id,
          access_level,
          granted_at,
          user_profiles!content_access_user_id_fkey(email),
          collections(name),
          categories(name),
          products(name)
        `);
      
      if (accessError) throw accessError;
      
      const formattedAccessList = accessData.map(access => {
        let contentName = '';
        let contentType: 'collection' | 'category' | 'product' = 'collection';
        
        if (access.collection_id && access.collections) {
          contentName = access.collections.name;
          contentType = 'collection';
        } else if (access.category_id && access.categories) {
          contentName = access.categories.name;
          contentType = 'category';
        } else if (access.product_id && access.products) {
          contentName = access.products.name;
          contentType = 'product';
        }

        return {
          id: access.id,
          user_id: access.user_id,
          collection_id: access.collection_id,
          category_id: access.category_id,
          product_id: access.product_id,
          access_level: access.access_level,
          granted_at: access.granted_at,
          user_email: access.user_profiles?.email || '',
          content_name: contentName,
          content_type: contentType,
        };
      });

      setAccessList(formattedAccessList);
    } catch (error) {
      console.error('Error fetching data:', error);
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    try {
      const params = {
        p_user_id: selectedUser,
        p_collection_id: selectedContentType === 'collection' ? selectedContent : null,
        p_category_id: selectedContentType === 'category' ? selectedContent : null,
        p_product_id: selectedContentType === 'product' ? selectedContent : null,
        p_access_type: selectedAccessLevel
      };

      console.log('Calling grant_content_access with:', params);
      const { data, error } = await supabase.rpc('grant_content_access', params);
      
      if (error) throw error;
      
      message.success('Access granted successfully');
      fetchData();
      
      // Reset form
      setSelectedUser('');
      setSelectedContentType('collection');
      setSelectedContent('');
      setSelectedAccessLevel('view');
    } catch (error) {
      console.error('Error granting access:', error);
      message.error('Failed to grant access');
    }
  };

  const handleRevokeAccess = async (record: UserAccess) => {
    try {
      const params = {
        user_id: record.user_id,
        collection_id: record.collection_id,
        category_id: record.category_id,
        product_id: record.product_id,
      };

      const { error } = await supabase.rpc('revoke_content_access', params);
      
      if (error) throw error;
      
      message.success('Access revoked successfully');
      fetchData();
    } catch (error) {
      console.error('Error revoking access:', error);
      message.error('Failed to revoke access');
    }
  };

  const columns: ColumnsType<UserAccess> = [
    {
      title: 'User',
      dataIndex: 'user_email',
      key: 'user_email',
    },
    {
      title: 'Content Type',
      dataIndex: 'content_type',
      key: 'content_type',
      render: (text: string) => text.charAt(0).toUpperCase() + text.slice(1),
    },
    {
      title: 'Content Name',
      dataIndex: 'content_name',
      key: 'content_name',
    },
    {
      title: 'Access Level',
      dataIndex: 'access_level',
      key: 'access_level',
      render: (text: string) => text.charAt(0).toUpperCase() + text.slice(1),
    },
    {
      title: 'Granted At',
      dataIndex: 'granted_at',
      key: 'granted_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button danger onClick={() => handleRevokeAccess(record)}>
          Revoke
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Grant Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select
            placeholder="Select User"
            value={selectedUser}
            onChange={setSelectedUser}
            className="w-full"
            options={users.map(user => ({ label: user.email, value: user.id }))}
          />
          <Select
            placeholder="Content Type"
            value={selectedContentType}
            onChange={setSelectedContentType}
            className="w-full"
            options={[
              { label: 'Collection', value: 'collection' },
              { label: 'Category', value: 'category' },
              { label: 'Product', value: 'product' },
            ]}
          />
          <Select
            placeholder="Select Content"
            value={selectedContent}
            onChange={setSelectedContent}
            className="w-full"
            options={
              selectedContentType === 'collection'
                ? collections.map(c => ({ label: c.name, value: c.id }))
                : selectedContentType === 'category'
                ? categories.map(c => ({ label: c.name, value: c.id }))
                : products.map(p => ({ label: p.name, value: p.id }))
            }
          />
          <Select
            placeholder="Access Level"
            value={selectedAccessLevel}
            onChange={setSelectedAccessLevel}
            className="w-full"
            options={[
              { label: 'View', value: 'view' },
              { label: 'Edit', value: 'edit' },
            ]}
          />
          <Button type="primary" onClick={handleGrantAccess}>
            Grant Access
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Current Access List</h2>
        <Table
          columns={columns}
          dataSource={accessList}
          loading={loading}
          rowKey="id"
        />
      </div>
    </div>
  );
};

export default UserAccessManager; 