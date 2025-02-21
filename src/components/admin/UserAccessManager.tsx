import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Database } from '@/types/supabase';
import { Button, Select, Table, message, Tag, Space, Modal } from 'antd';
import type { ColumnsType } from 'antd/es/table';

type AccessType = 'view' | 'edit';

interface UserAccess {
  id: string;
  user_id: string;
  collection_id: string | null;
  category_id: string | null;
  product_id: string | null;
  access_type: AccessType;
  granted_at: string;
  user_email: string;
  content_name: string;
  content_type: 'collection' | 'category' | 'product';
}

interface ContentItem {
  id: string;
  name: string;
}

interface UserWithAccess {
  id: string;
  email: string;
  role: string;
  existingAccess?: {
    content_type: 'collection' | 'category' | 'product';
    content_name: string;
    access_type: AccessType;
  }[];
}

interface AccessData {
  id: string;
  user_id: string;
  collection_id: string | null;
  category_id: string | null;
  product_id: string | null;
  access_type: string;
  granted_at: string;
  user_profiles: { email: string } | null;
  collections: { name: string } | null;
  categories: { name: string } | null;
  products: { name: string } | null;
}

interface UserData {
  user_id: string;
  email: string;
  role: string;
}

const UserAccessManager: React.FC = () => {
  const supabase = useSupabaseClient<Database>();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [collections, setCollections] = useState<ContentItem[]>([]);
  const [categories, setCategories] = useState<ContentItem[]>([]);
  const [products, setProducts] = useState<ContentItem[]>([]);

  // Modal states for assigning access
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedContentType, setSelectedContentType] = useState<'collection' | 'category' | 'product'>('collection');
  const [selectedContent, setSelectedContent] = useState<string>('');
  const [selectedAccessType, setSelectedAccessType] = useState<AccessType>('view');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users with their existing access
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('user_id, email, role');
      
      if (userError) throw userError;

      // Fetch current access list
      const { data: accessData, error: accessError } = await supabase
        .from('collection_access')
        .select(`
          id,
          user_id,
          collection_id,
          category_id,
          product_id,
          access_type,
          granted_at,
          user_profiles!collection_access_user_id_fkey(email),
          collections(name),
          categories(name),
          products(name)
        `);
      
      if (accessError) throw accessError;
      
      // Process access data
      const formattedAccessList = (accessData as AccessData[]).map(access => {
        const contentType = access.collection_id 
          ? 'collection' as const
          : access.category_id 
          ? 'category' as const 
          : 'product' as const;

        return {
          id: access.id,
          user_id: access.user_id,
          collection_id: access.collection_id,
          category_id: access.category_id,
          product_id: access.product_id,
          access_type: access.access_type as AccessType,
          granted_at: access.granted_at,
          user_email: access.user_profiles?.email || '',
          content_name: access.collections?.name || access.categories?.name || access.products?.name || '',
          content_type: contentType,
        };
      });

      // Combine user data with their access information
      const usersWithAccess = (userData as UserData[]).map(user => ({
        id: user.user_id,
        email: user.email,
        role: user.role,
        existingAccess: formattedAccessList
          .filter(access => access.user_id === user.user_id)
          .map(access => ({
            content_type: access.content_type,
            content_name: access.content_name,
            access_type: access.access_type,
          })),
      })) as UserWithAccess[];

      setUsers(usersWithAccess);

      // Fetch collections, categories, and products
      const [collectionResult, categoryResult, productResult] = await Promise.all([
        supabase.from('collections').select('id, name'),
        supabase.from('categories').select('id, name'),
        supabase.from('products').select('id, name'),
      ]);

      if (collectionResult.error) throw collectionResult.error;
      if (categoryResult.error) throw categoryResult.error;
      if (productResult.error) throw productResult.error;

      setCollections(collectionResult.data);
      setCategories(categoryResult.data);
      setProducts(productResult.data);

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
        p_access_type: selectedAccessType
      };

      console.log('Granting access with params:', params);
      const { error } = await supabase.rpc('grant_collection_access', params);
      
      if (error) throw error;
      
      message.success('Access granted successfully');
      setIsAssignModalVisible(false);
      fetchData();
      
      // Reset form
      setSelectedContentType('collection');
      setSelectedContent('');
      setSelectedAccessType('view');
    } catch (error) {
      console.error('Error granting access:', error);
      message.error('Failed to grant access');
    }
  };

  const handleRevokeAccess = async (userId: string, access: NonNullable<UserWithAccess['existingAccess']>[0]) => {
    try {
      const params = {
        p_user_id: userId,
        p_collection_id: access.content_type === 'collection' ? selectedContent : null,
        p_category_id: access.content_type === 'category' ? selectedContent : null,
        p_product_id: access.content_type === 'product' ? selectedContent : null
      };

      console.log('Calling revoke_collection_access with:', params);
      const { error } = await supabase.rpc('revoke_collection_access', params);
      
      if (error) throw error;
      
      message.success('Access revoked successfully');
      fetchData();
    } catch (error) {
      console.error('Error revoking access:', error);
      message.error('Failed to revoke access');
    }
  };

  const expandedRowRender = (record: UserWithAccess) => {
    const accessColumns: ColumnsType<NonNullable<UserWithAccess['existingAccess']>[0]> = [
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
        title: 'Access Type',
        dataIndex: 'access_type',
        key: 'access_type',
        render: (text: string) => (
          <Tag color={text === 'edit' ? 'blue' : 'green'}>
            {text.charAt(0).toUpperCase() + text.slice(1)}
          </Tag>
        ),
      },
      {
        title: 'Action',
        key: 'action',
        render: (_: unknown, access: NonNullable<UserWithAccess['existingAccess']>[0]) => (
          <Button 
            type="link" 
            danger 
            onClick={() => handleRevokeAccess(record.id, access)}
          >
            Unlink
          </Button>
        ),
      },
    ];

    return (
      <div>
        <div className="mb-4">
          <Button 
            type="primary" 
            onClick={() => {
              setSelectedUser(record.id);
              setIsAssignModalVisible(true);
            }}
          >
            Assign Collection
          </Button>
        </div>
        <Table
          columns={accessColumns}
          dataSource={record.existingAccess || []}
          pagination={false}
        />
      </div>
    );
  };

  const columns: ColumnsType<UserWithAccess> = [
    {
      title: 'User',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (text: string) => text.charAt(0).toUpperCase() + text.slice(1),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: UserWithAccess) => (
        <Space>
          <Button>Edit</Button>
          <Button danger>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <Table
          columns={columns}
          expandable={{
            expandedRowRender,
            expandRowByClick: true,
          }}
          dataSource={users}
          loading={loading}
          rowKey="id"
        />
      </div>

      {/* Assign Collection Modal */}
      <Modal
        title="Assign Collection"
        open={isAssignModalVisible}
        onOk={handleGrantAccess}
        onCancel={() => setIsAssignModalVisible(false)}
      >
        <div className="space-y-4">
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
            placeholder="Access Type"
            value={selectedAccessType}
            onChange={setSelectedAccessType}
            className="w-full"
            options={[
              { label: 'View', value: 'view' },
              { label: 'Edit', value: 'edit' },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
};

export default UserAccessManager; 